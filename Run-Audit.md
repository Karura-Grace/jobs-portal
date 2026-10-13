# jobs.pac.africa · Security & Hardening Task (v2)

**For:** Claude Code
**Repo:** github.com/Gordian-Knotz/jobs-pac (private, branch `main`)
**Supersedes:** CLAUDE_CODE_SECURITY_AUDIT.md (20 Aug 2026)
**Updated:** 20 August 2026, against `context-sessions/` docs 00–07 and migrations 001–025

---

## What changed since v1

The original task file was written against Vercel firewall traffic alone, without repo visibility. With the project docs now available, most of it is resolved or reprioritised.

**Closed — do not re-investigate:**

- **`/0446ca07ab157f90/view`** — confirmed a generic scanner probing a made-up path. Matches no job slug, no CV hash. The 16-hex-char shape coincidentally resembles the R2 archive key format (`r2:archive/<sha256[0:16]>/<name>`) but is not enumeration of it. Closed.
- **S8, field tampering (privilege escalation)** — already found and fixed. `profiles_update` constrained the row but not the columns; RLS has no column granularity, so `PATCH /rest/v1/profiles?id=eq.<own-uid> {"role":"admin"}` succeeded with the anon key and a user's own token. Verified live: a seeker self-promoted and read 4,355 of 4,356 applications. Closed by `guard_profile_columns()` in migration 025, which also locks `email` and `company_id`. No further action in the repo.
- **S1/S3, key exposure** — service role key is `scripts/migrate-cvs.mjs` only, never `NEXT_PUBLIC_`, not used by the app. `lib/r2.ts` uses `import "server-only"` specifically so a mistaken client import fails the build. Verified client bundle stayed at 103 kB after adding the AWS SDK.
- **S2, git history** — already rewritten once, deliberately, before the first push, specifically to remove `chunks/seed_applications_*.sql` (4,355 applicants' names, emails, phones). Verified: no `chunks/` object exists anywhere in the repo, no applicant email in any tracked blob. No further action.
- **S16, uploads** — CV archive migrated to R2, 3,936 rows repointed, 0 failures. Both buckets private, presigned reads only, content-hashed keys. Public HTTP links were explicitly considered and rejected given these are ~4,000 people's CVs including addresses and ID numbers.
- **S15, XSS** — `lib/sanitize.ts` allowlist sanitiser on the write side, checked against 11 XSS payloads, applied to all three job body rich-text fields.
- **S18, headers** — CSP with per-request nonce and `strict-dynamic`, HSTS, COOP, XFO, Permissions-Policy already in `next.config.ts` / `middleware.ts`.
- **S4, RLS** — Supabase security advisor is clean apart from `security definer` functions (each carries its own auth check, by design) and the leaked-password toggle (below). RLS verified per role by impersonation, not from a superuser session — correct methodology, no rework needed.

**No longer applicable:** the original file assumed the app might still touch PHP or the old host directly. It does not. `next dev`/`build` has no dependency on HostPinnacle. That exposure is entirely separate infrastructure, addressed in P3 below.

---

## Ground rules (unchanged)

1. Read before you write. Full findings before any PR.
2. No schema changes without a migration file under `migrations/`, following the existing numbered convention (currently at 025), with a note on what it fixes, matching the existing `migrations/README.md` style.
3. Assume every endpoint is called directly, not through the UI.
4. Changed files delivered as `.tar.gz`, not the full codebase.
5. This is a live product in active use by HR staff. A regression is not hypothetical risk, it's a real outage.

---

## P0 · Admin list audit — needs Imran, not code

Not a coding task, but blocking everything else in priority. There is no audit log on `profiles`, so there is no way to determine from the database whether the role-escalation bug was ever exploited before the 025 fix.

Run and paste the output before anything else proceeds:

```sql
select email, role, created_at from public.profiles where role = 'admin' order by created_at;
```

Four admins are expected: `it@pac.africa`, `tsettim@`, `msum@`, plus one more per the docs. **If any row is unfamiliar, treat all 4,355 applications as exposed and act under the Kenya DPA's breach-notification duty before doing anything else on this list.**

Claude Code's job here, once the query result is in hand: check whether Supabase logs (Postgres logs / API logs, whatever retention Supabase Pro or the current plan gives) retain enough history to show `PATCH /rest/v1/profiles` calls with a `role` field prior to migration 025's deploy timestamp. Report what's retrievable, don't guess.

---

## P1 · Auth hardening — in the exact order the docs specify

This sequencing matters. Getting it backwards takes sign-in down for every user.

### 1. Captcha — currently wired, not enforcing

Confirmed by probe on 2026-08-20: the auth endpoint returns `invalid_credentials`, not a captcha error. `NEXT_PUBLIC_CAPTCHA_*` vars are unset.

**Do steps in this order and no other:**

1. Decide the provider — Turnstile or hCaptcha. It must match whatever is set in Supabase → Auth → Attack Protection; a Turnstile token is not valid for hCaptcha and the mismatch surfaces only as `invalid-input-response` on every attempt, which is a confusing failure mode to debug live.
   - If Turnstile: `@hcaptcha/react-hcaptcha` becomes dead code, flag it for removal.
   - If hCaptcha: keep it, and the Supabase-side setting must be switched to match.
2. Set `NEXT_PUBLIC_CAPTCHA_PROVIDER` and `NEXT_PUBLIC_CAPTCHA_SITE_KEY` in Vercel. Redeploy. Confirm the widget renders and sends a token. Supabase ignores it while its own toggle is off, so nothing breaks yet.
3. **Only then** enable it in Supabase → Auth → Attack Protection.

CSP already allows both providers' frame/script/connect origins — confirm this is still true after any header changes, since `frame-src` was previously `'none'` and would silently swallow the challenge iframe with no console error to explain why.

> Acceptance test: a scripted form submission with no valid token is rejected server-side by Supabase, and a real user completing the challenge signs in normally.

### 2. Leaked-password protection

Supabase → Auth → Policies. One toggle, checks new passwords against HaveIBeenPwned. This is the only outstanding advisor finding that isn't an intentional design choice — turn it on. Cheap and there's now a password-change form in Settings that makes it directly relevant.

### 3. Rate limiting

Currently zero anywhere — confirmed in the firewall log (`Rate Limited –`, `Custom Rules 0`).

**Traffic split that determines where each limit lives:**

| path | reaches Vercel? | limit where |
|---|---|---|
| apply submission | yes — server action since migration 024 | Vercel WAF, `POST /jobs/*` |
| dashboard mutations | yes, server actions | Vercel WAF, `POST /dashboard`, `/admin` |
| data export | yes | Vercel WAF, `/dashboard/seeker/export` |
| sign-in / sign-up | **no** — browser calls Supabase directly | Supabase → Auth → Rate Limits, plus captcha above |

Suggested Vercel WAF rules: 30/60s per IP on authenticated POSTs (deny), 20/60s on public POSTs (**challenge, not deny** — Kenyan mobile traffic sits behind carrier NAT, one IP can be hundreds of people), 5/hour on the export route, 200/60s on `/jobs` (challenge).

**If Vercel rate limiting is plan-gated:** build the Postgres-backed alternative the docs already scoped. Since migration 024 the apply flow is a server action on the app's own origin, so `x-forwarded-for` is available to Next — a small counter table keyed on a hashed IP survives serverless cold starts (unlike an in-memory counter) and sits at the layer that knows a request is an application, not just a page view. Estimated an hour's work; not started. Implement as a migration plus a helper in `lib/`, following the existing `lib/` module conventions (see `lib/auth.ts` for the pattern this codebase uses for server-side guards).

> Acceptance test: sixth attempt within the window returns 429 or is challenged per the table above; a legitimate user on a different IP is unaffected.

---

## P2 · Core product gaps (not security, but blocking real use)

Only pick these up once P0 and P1 are closed.

- **Email notifications** — nothing sends. Resend is the stated default. Minimum: application received (employer), status changed (applicant), job approved/rejected (employer). This is currently the most-felt gap for the HR team using the system day to day.
- **Seed historical job listings** — `migrate.py` never builds `seed_jobs.sql`. Steps are laid out in `02-data-recovery-and-migration.md` and `07-next-steps-and-todos.md` §5: parse `noo_job` posts, inspect a sample's postmeta first since those keys aren't catalogued yet, map term relationships to new category/location UUIDs, emit chunked seed SQL with `on conflict (wp_post_id) do nothing`, then fuzzy-backfill `applications.job_id` against `wp_job_title` — review before committing, it's imperfect.
- **Move `old-cvs/`** off the project directory. 1.84 GB of ~4,000 people's CVs sitting locally, one `git add -f` from being published. R2 has them now; this is a pure cleanup with no downside.

---

## P3 · Infrastructure, outside this repo but not out of scope for the report

- **HostPinnacle account is still live**, still hosting five other production databases on the account that got compromised: `pacafric_CRM`, `pacafric_gk`, `pacafric_hr`, `pacafric_pacmain` (main pac.africa site), `pacafric_survey`. The support ticket asking for a file-ownership fix and a security log audit was drafted and **never confirmed resolved**. Whatever vector wiped `wp-admin/`, `wp-includes/`, `wp-config.php` and `index.php` on 14 August could equally be sitting against any of those five. This is the single largest unresolved exposure connected to this project and it is not something Claude Code can act on directly — it needs the HostPinnacle ticket followed up and the hardening checklist (password rotation across cPanel and each database, FTP/SSH and email account audit, cron audit, PHP version, ModSecurity, 2FA) confirmed complete, not just drafted.
- **Generate proper Supabase types** — `types/database.ts` is hand-maintained across 25 migrations and has drifted before. Run `supabase gen types typescript --project-id khdvagjfonbiezkybpvh` and diff against the current hand-maintained file before replacing it wholesale.
- **Tests** — none exist. If picked up, the RLS matrix is the right first target given it's security-critical and cheap to assert. Three probe patterns already learned the hard way, worth encoding directly into the test helpers: impersonate the real role rather than testing as superuser; assert on rows affected, not absence of an error, since RLS denies by returning zero rows rather than erroring; and confirm the values in an update actually differ, or a no-op will read as a false pass.

---

## Report format

```markdown
# jobs.pac.africa · Status Update · [date]

## P0 — admin audit result
[names, familiar or not, DPA action if needed]

## P1 — auth hardening
[captcha: which provider, which step reached; leaked-password: on/off;
rate limiting: Vercel WAF or Postgres-backed, rules applied]

## P2 / P3 progress
[whatever was picked up]

## Anything found outside this list
[unexpected findings, with file:line evidence]
```

---

## Sequence

P0 first, always — it's a five-minute query that determines whether this is a hardening pass or a breach-notification event. Then P1 in the exact sub-order given; the captcha and rate-limiting steps have documented failure modes for going out of order. P2 and P3 only after P1 is confirmed closed.
