#!/usr/bin/env node
/**
 * Move the recovered WordPress CVs into Cloudflare R2 and repoint
 * applications.cv_url at them.
 *
 *   node scripts/migrate-cvs.mjs --dry-run     inspect, upload nothing
 *   node scripts/migrate-cvs.mjs --limit=25    a small real batch first
 *   node scripts/migrate-cvs.mjs               the whole archive
 *
 * WHY R2 AND NOT SUPABASE STORAGE
 * The referenced archive is 1,214 MB across 3,752 distinct files. Supabase's
 * free tier is 1 GB, so it does not fit — and even a 3 MB per-file cap left it
 * 83% full before a single new applicant arrived. R2's free tier is 10 GB, is
 * S3-compatible, charges nothing for egress, and is private by default with
 * presigned reads: the same security model, without the quota anxiety.
 *
 * New CVs submitted through the site keep going to the Supabase `cvs` bucket.
 * That path already works in production and averages ~250 KB, so 1 GB is years
 * of intake. The app reads both — see lib/cv-access.ts.
 *
 * WHY THIS IS URGENT
 * All 4,118 legacy cv_url values point at
 * https://jobs.pac.africa/wp-content/uploads/jobmonster/... and every one now
 * returns 403: the domain was cut over to Vercel, so those paths hit the
 * Next.js app instead of the old WordPress host. Until this runs, no archived
 * CV is readable anywhere.
 *
 * SAFE TO RE-RUN. It only selects rows whose cv_url still starts with http, so
 * migrated rows are skipped and an interrupted run resumes.
 *
 * WHY CONTENT HASH RATHER THAN A RANDOM PREFIX
 * 322 basenames repeat across the archive, so a filename cannot identify a file.
 * Hashing also yields one object per distinct CV even when the same person
 * applied to several roles.
 *
 * REQUIRES: SUPABASE_SERVICE_ROLE_KEY (historical rows have applicant_id NULL,
 * so RLS would hide them) and the four R2_* variables.
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ARCHIVE_DIR = path.resolve("old-cvs");
const KEY_PREFIX = "archive/";
const CONCURRENCY = 8;
const PAGE = 500;

/** The archive root corresponds to this path on the old host. */
const URL_MARKER = "/uploads/jobmonster/";

const MIME = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const LIMIT = Number(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);
/** Optional guard; R2 has room for everything, so unset by default. */
const MAX_MB = Number(argv.find((a) => a.startsWith("--max-file-mb="))?.split("=")[1] ?? 0);
const MAX_BYTES = MAX_MB > 0 ? MAX_MB * 1024 * 1024 : Infinity;

// ── env ────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnvLocal();

const {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
} = process.env;

const missing = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!DRY_RUN) {
  if (!R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET) missing.push("R2_BUCKET");
}

if (missing.length) {
  console.error(
    `Missing in .env.local: ${missing.join(", ")}\n\n` +
      "Supabase service_role: dashboard > Settings > API.\n" +
      "R2: Cloudflare dashboard > R2 > Manage API Tokens (Object Read & Write).\n" +
      "R2_ACCOUNT_ID is in the R2 overview URL.\n" +
      "None of these may be prefixed NEXT_PUBLIC_.\n\n" +
      "--dry-run needs only the Supabase pair."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const r2 = DRY_RUN
  ? null
  : new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

// ── index the archive ──────────────────────────────────────────────────────
/**
 * Two lookups: exact relative path (authoritative) and basename (fallback, used
 * only when unambiguous). Guessing among 322 repeated basenames would attach
 * the wrong CV to the wrong person, which is worse than leaving it unmigrated.
 */
async function indexArchive(dir) {
  const byRelPath = new Map();
  const byBasename = new Map();
  let ignored = 0;

  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!MIME[path.extname(entry.name).toLowerCase()]) {
        ignored++;
        continue;
      }
      const rel = path.relative(dir, full).split(path.sep).join("/");
      byRelPath.set(rel.toLowerCase(), full);
      const key = entry.name.toLowerCase();
      if (!byBasename.has(key)) byBasename.set(key, []);
      byBasename.get(key).push(full);
    }
  }

  await walk(dir);
  return { byRelPath, byBasename, ignored };
}

/** Turns a dead WordPress URL into the archive-relative path it implies. */
function relPathFromUrl(cvUrl) {
  let pathname;
  try {
    pathname = new URL(cvUrl).pathname;
  } catch {
    return null;
  }
  const idx = pathname.toLowerCase().indexOf(URL_MARKER);
  const tail = idx === -1 ? pathname : pathname.slice(idx + URL_MARKER.length);
  try {
    return decodeURIComponent(tail).replace(/^\/+/, "");
  } catch {
    return tail.replace(/^\/+/, "");
  }
}

function safeName(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-90) || "cv"
  );
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
      while (cursor < items.length) await worker(items[cursor++]);
    })
  );
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(ARCHIVE_DIR)) {
    console.error(`Archive not found: ${ARCHIVE_DIR}`);
    process.exit(1);
  }

  console.log(`${DRY_RUN ? "DRY RUN — " : ""}indexing ${ARCHIVE_DIR} …`);
  const { byRelPath, byBasename, ignored } = await indexArchive(ARCHIVE_DIR);
  console.log(
    `  ${byRelPath.size} candidate files indexed` +
      (ignored ? `, ${ignored} non-CV files ignored` : "")
  );

  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, cv_url")
      .like("cv_url", "http%")
      .order("id")
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Fetching applications: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const targets = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(
    `  ${rows.length} applications still reference the old host` +
      (LIMIT > 0 ? ` (processing ${targets.length})` : "")
  );
  if (!DRY_RUN) console.log(`  uploading to R2 bucket "${R2_BUCKET}"`);

  const stats = {
    uploaded: 0,
    reused: 0,
    rewritten: 0,
    unmatched: 0,
    ambiguous: 0,
    oversized: 0,
    failed: 0,
  };
  const problems = [];
  const oversized = [];
  const matchedFiles = new Set();
  const uploadedKeys = new Map(); // hash -> key
  const uniqueBytes = new Map();
  let skippedBytes = 0;
  let done = 0;

  await mapLimit(targets, CONCURRENCY, async (row) => {
    if (++done % 250 === 0) console.log(`  … ${done}/${targets.length}`);

    const rel = relPathFromUrl(row.cv_url);
    if (!rel) {
      stats.unmatched++;
      problems.push(`${row.id}  unparseable url  ${row.cv_url}`);
      return;
    }

    let file = byRelPath.get(rel.toLowerCase());
    if (!file) {
      const candidates = byBasename.get(path.basename(rel).toLowerCase()) ?? [];
      if (candidates.length === 1) file = candidates[0];
      else if (candidates.length > 1) {
        stats.ambiguous++;
        problems.push(`${row.id}  ambiguous basename x${candidates.length}  ${rel}`);
        return;
      }
    }
    if (!file) {
      stats.unmatched++;
      problems.push(`${row.id}  no file on disk  ${rel}`);
      return;
    }

    matchedFiles.add(file);
    const buffer = await readFile(file);

    if (buffer.length > MAX_BYTES) {
      stats.oversized++;
      skippedBytes += buffer.length;
      oversized.push(`${(buffer.length / 1048576).toFixed(1)} MB  ${path.basename(file)}`);
      return;
    }

    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const key = `${KEY_PREFIX}${hash}/${safeName(path.basename(file))}`;
    const contentType = MIME[path.extname(file).toLowerCase()];
    uniqueBytes.set(hash, buffer.length);

    if (DRY_RUN) {
      stats.rewritten++;
      return;
    }

    if (uploadedKeys.has(hash)) {
      stats.reused++;
    } else {
      try {
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        );
        uploadedKeys.set(hash, key);
        stats.uploaded++;
      } catch (err) {
        stats.failed++;
        problems.push(`${row.id}  UPLOAD FAILED  ${err.message}  ${key}`);
        return;
      }
    }

    // The r2: prefix is what tells lib/cv-access.ts which backend to sign.
    const { error: updateError } = await supabase
      .from("applications")
      .update({ cv_url: `r2:${key}` })
      .eq("id", row.id);

    if (updateError) {
      stats.failed++;
      problems.push(`${row.id}  DB UPDATE FAILED  ${updateError.message}`);
      return;
    }
    stats.rewritten++;
  });

  const orphans = [...byRelPath.values()].filter((f) => !matchedFiles.has(f));
  const storedMb = (
    [...uniqueBytes.values()].reduce((s, b) => s + b, 0) / 1048576
  ).toFixed(1);

  console.log("\n── result ─────────────────────────────");
  console.log(`  distinct objects      ${uniqueBytes.size}`);
  console.log(`  storage needed        ${storedMb} MB`);
  console.log(`  objects uploaded      ${stats.uploaded}`);
  console.log(`  shared existing       ${stats.reused}`);
  console.log(`  cv_url rewritten      ${stats.rewritten}`);
  console.log(`  no matching file      ${stats.unmatched}`);
  console.log(`  ambiguous basename    ${stats.ambiguous}`);
  if (MAX_MB > 0) {
    console.log(
      `  skipped over ${MAX_MB} MB     ${stats.oversized}` +
        ` (${(skippedBytes / 1048576).toFixed(1)} MB left behind)`
    );
  }
  console.log(`  failed                ${stats.failed}`);
  console.log(`  archive files unused  ${orphans.length}`);

  if (oversized.length) {
    console.log("\n── skipped for size (cv_url unchanged) ─");
    for (const line of oversized.slice(0, 15)) console.log(`  ${line}`);
    if (oversized.length > 15) console.log(`  … ${oversized.length - 15} more`);
  }

  if (problems.length) {
    console.log("\n── needs a look (first 40) ────────────");
    for (const line of problems.slice(0, 40)) console.log(`  ${line}`);
    if (problems.length > 40) console.log(`  … ${problems.length - 40} more`);
  }

  if (DRY_RUN) console.log("\nDry run — nothing uploaded, no rows changed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
