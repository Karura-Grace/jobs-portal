import "server-only";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 access for the recovered CV archive.
 *
 * The bucket is private. Nothing here ever produces a public URL — reads go out
 * as presigned links that expire, which is the same model as the Supabase `cvs`
 * bucket. These are ~4,000 people's CVs, including home addresses and ID
 * numbers, so a permanent link is not an acceptable shape for them.
 *
 * `server-only` is imported deliberately: if this module is ever pulled into a
 * client component the build fails loudly rather than shipping the secret.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

export const R2_BUCKET = process.env.R2_BUCKET ?? "pac-cvs";

/** False until the four env vars are set, so callers can degrade rather than throw. */
export const r2Configured = Boolean(
  ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY
);

let client: S3Client | null = null;

function getClient(): S3Client | null {
  if (!r2Configured) return null;
  client ??= new S3Client({
    // R2 ignores region but the SDK requires one.
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/** Short-lived read URL for one object, or null if R2 is not configured. */
export async function presignR2Get(
  key: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const s3 = getClient();
  if (!s3) return null;

  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  } catch {
    return null;
  }
}

/**
 * Presigns many keys. Signing is a local HMAC with no network call, so this is
 * cheap — it exists to keep the call sites tidy, not to batch requests.
 */
export async function presignR2Many(
  keys: string[],
  expiresInSeconds = 300
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!r2Configured || keys.length === 0) return out;

  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      const url = await presignR2Get(key, expiresInSeconds);
      if (url) out.set(key, url);
    })
  );
  return out;
}
