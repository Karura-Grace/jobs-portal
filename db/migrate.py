"""
jobs.pac.africa — WordPress → Supabase Migration Script
Reads: pacafric_wp_jobs.sql
Outputs: seed_categories.sql, seed_locations.sql, seed_applications.sql
Run: python3 migrate.py
Then import each .sql file into Supabase via Dashboard → SQL Editor
"""

import re
import json
import uuid
from collections import defaultdict

DUMP_FILE = "pacafric_wp_jobs.sql"
PREFIX = "SDzBUb_"

print("Loading dump...")
with open(DUMP_FILE, "r", errors="ignore") as f:
    content = f.read()
print(f"Loaded {len(content)/1024/1024:.1f} MB")

# ── HELPER ────────────────────────────────────────────────────
def slugify(text):
    import re
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text[:100]

def esc(s):
    if s is None: return "NULL"
    s = str(s).replace("'", "''")
    return f"'{s}'"

# ── 1. PARSE TERMS ────────────────────────────────────────────
print("\n[1/5] Parsing terms...")
terms = {}
terms_start = content.find(f"INSERT INTO `{PREFIX}terms`")
terms_block = content[terms_start:terms_start+40000]
for m in re.finditer(r"\((\d+),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*\d+\)", terms_block):
    terms[m.group(1)] = {"name": m.group(2), "slug": m.group(3)}
print(f"  Terms: {len(terms)}")

# ── 2. PARSE TAXONOMIES ───────────────────────────────────────
print("[2/5] Parsing taxonomies...")
tax_start = content.find(f"INSERT INTO `{PREFIX}term_taxonomy`")
tax_end = content.find("\n\n--", tax_start+100)
tax_raw = content[tax_start:tax_end]

job_categories = []
job_locations = []
job_types_found = []

for m in re.finditer(r"\((\d+),\s*(\d+),\s*'([^']+)',\s*'[^']*',\s*(\d+),\s*(\d+)\)", tax_raw):
    ttid, term_id, taxonomy, parent, count = m.groups()
    term = terms.get(term_id, {"name": "?", "slug": "?"})
    entry = {"id": str(uuid.uuid4()), "name": term["name"], "slug": term["slug"],
             "wp_term_id": term_id, "count": int(count)}
    if taxonomy == "job_category":
        job_categories.append(entry)
    elif taxonomy == "job_location":
        job_locations.append(entry)
    elif taxonomy == "job_type":
        job_types_found.append(entry)

print(f"  Categories: {len(job_categories)}")
print(f"  Locations: {len(job_locations)}")
print(f"  Job types: {len(job_types_found)}")

# ── 3. PARSE APPLICATIONS ────────────────────────────────────
print("[3/5] Parsing applications...")

app_ids = set()
for m in re.finditer(r"'noo_application'", content):
    start = content.rfind("(", 0, m.start())
    id_m = re.match(r"\((\d+),", content[start:start+20])
    if id_m:
        app_ids.add(id_m.group(1))
print(f"  Application post IDs: {len(app_ids)}")

# Get application dates and titles from posts table
app_posts = {}
for m in re.finditer(r"'noo_application'", content):
    start = content.rfind("(", 0, m.start())
    snippet = content[start:start+600]
    pid_m = re.match(r"\((\d+),", snippet)
    if not pid_m: continue
    pid = pid_m.group(1)
    # Extract date (3rd field)
    date_m = re.search(r"'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'", snippet)
    date = date_m.group(0).strip("'") if date_m else None
    # Extract post_status
    status_m = re.search(r"'(publish|pending|draft|private|trash)'", snippet)
    status = status_m.group(1) if status_m else "publish"
    # Extract title (post_title) — appears after large content field
    app_posts[pid] = {"date": date, "status": status}

# Get postmeta for all application IDs
print("  Parsing application postmeta...")
app_meta = defaultdict(dict)
for m in re.finditer(r"\(\d+,\s*(\d+)\s*,\s*'([^']+)',\s*'([^']*?)'\s*\)", content):
    post_id, meta_key, meta_val = m.group(1), m.group(2), m.group(3)
    if post_id in app_ids:
        app_meta[post_id][meta_key] = meta_val.replace("\\'", "'")

print(f"  Applications with meta: {len(app_meta)}")

# ── 4. WRITE SEED SQLs ────────────────────────────────────────
print("[4/5] Writing seed SQL files...")

# 4a. Categories
with open("/home/claude/seed_categories.sql", "w") as f:
    f.write("-- Job Categories (migrated from Noo JobMonster)\n")
    f.write("-- Run in Supabase SQL Editor\n\n")
    f.write("insert into job_categories (id, name, slug) values\n")
    rows = []
    seen_slugs = set()
    for cat in job_categories:
        slug = cat["slug"] if cat["slug"] != "?" else slugify(cat["name"])
        # deduplicate
        orig_slug = slug
        i = 2
        while slug in seen_slugs:
            slug = f"{orig_slug}-{i}"
            i += 1
        seen_slugs.add(slug)
        rows.append(f"  ({esc(cat['id'])}, {esc(cat['name'])}, {esc(slug)})")
    f.write(",\n".join(rows) + "\non conflict (slug) do nothing;\n")

# 4b. Locations
with open("/home/claude/seed_locations.sql", "w") as f:
    f.write("-- Job Locations (migrated from Noo JobMonster)\n\n")
    f.write("insert into job_locations (id, name, slug) values\n")
    rows = []
    seen_slugs = set()
    for loc in job_locations:
        slug = loc["slug"] if loc["slug"] != "?" else slugify(loc["name"])
        orig_slug = slug
        i = 2
        while slug in seen_slugs:
            slug = f"{orig_slug}-{i}"
            i += 1
        seen_slugs.add(slug)
        rows.append(f"  ({esc(loc['id'])}, {esc(loc['name'])}, {esc(slug)})")
    f.write(",\n".join(rows) + "\non conflict (slug) do nothing;\n")

# 4c. Applications (historical — no auth.uid, applicant_id NULL)
STATUS_MAP = {
    "publish": "pending",
    "pending": "pending",
    "draft": "pending",
    "private": "shortlisted",
    "trash": "rejected",
}

with open("/home/claude/seed_applications.sql", "w") as f:
    f.write("-- Historical Applications (migrated from Noo JobMonster)\n")
    f.write("-- applicant_id is NULL for historical records (no auth account)\n")
    f.write("-- applicant_email is the join key for future account linking\n\n")

    rows = []
    skipped = 0
    for post_id, meta in app_meta.items():
        email = meta.get("_candidate_email", "").strip()
        if not email or "@" not in email:
            skipped += 1
            continue

        app_id = str(uuid.uuid4())
        name = meta.get("applicant_name",
               meta.get("first_name", "") + " " + meta.get("last_name", "")).strip() or None
        phone = meta.get("phone_number", meta.get("phone", "")).strip() or None
        cover = meta.get("application_message", "").strip() or None
        job_title = meta.get("_job_applied_for", "").strip() or None
        cv_url = None
        # Try to extract CV URL from _attachment serialized value
        att = meta.get("_attachment", "")
        url_m = re.search(r'https?://[^\s\'"\\]+', att)
        if url_m:
            cv_url = url_m.group(0)

        post_info = app_posts.get(post_id, {})
        wp_status = post_info.get("status", "publish")
        app_status = STATUS_MAP.get(wp_status, "pending")
        applied_at = post_info.get("date") or "2020-01-01 00:00:00"

        rows.append(
            f"  ({esc(app_id)}, NULL, NULL, {esc(name)}, {esc(email)}, "
            f"{esc(phone)}, {esc(cover)}, {esc(cv_url)}, "
            f"'{app_status}', {esc(job_title)}, {esc(post_id)}, "
            f"'{applied_at}')"
        )

    f.write(
        "insert into applications\n"
        "  (id, job_id, applicant_id, applicant_name, applicant_email,\n"
        "   applicant_phone, cover_letter, cv_url,\n"
        "   status, wp_job_title, wp_post_id, applied_at)\n"
        "values\n"
    )
    f.write(",\n".join(rows))
    f.write("\non conflict (wp_post_id) do nothing;\n")
    print(f"  Applications written: {len(rows)}, skipped (no email): {skipped}")

print("[5/5] Done.\n")
print("Files written:")
print("  /home/claude/schema.sql         — run first in Supabase SQL Editor")
print("  /home/claude/seed_categories.sql — run second")
print("  /home/claude/seed_locations.sql  — run third")
print("  /home/claude/seed_applications.sql — run last (largest)")
print(f"\nTotal applications to migrate: {len(rows)}")
