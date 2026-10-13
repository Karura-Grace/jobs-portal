# jobs.pac.africa · Full Launch Readiness Task (v3)

**For:** Claude Code
**Repo:** github.com/Gordian-Knotz/jobs-pac (private, branch `main`)
**Supersedes:** CLAUDE_CODE_SECURITY_AUDIT.md, CLAUDE_CODE_SECURITY_AUDIT_v2.md
**Authority:** Gordian Knotz Launch Readiness Handbook — all three sections (S1–S18, G1–G20, C1–C18)
**Updated:** 20 August 2026, against `context-sessions/` docs 00–07, migrations 001–025, and the live handbook

---

## Why this version exists

v1 was written from firewall traffic alone. v2 added repo visibility and closed most of the Security section. This version adds the two sections v2 didn't touch — **Search Visibility (G1–G20)** and **Content & Compliance (C1–C18)** — because the product is live and in real use, and search and compliance gaps are now costing something every day they're open, the same way the security gaps were.

Every item below states its handbook code, its current status against the actual docs, and what's left. Where status is unknown, that's stated too — don't assume closed just because it isn't flagged broken.

---

## Section 1 · Security Hardening (S1–S18)

### Closed — verified in the docs, no rework

| Item | Status |
|---|---|
| **S1** Hide API keys | Service role key confined to `scripts/migrate-cvs.mjs`, never `NEXT_PUBLIC_`. |
| **S2** Purge Git secrets | History rewritten before first push specifically to remove applicant data from `chunks/`. Verified absent from every tracked blob. |
| **S3** Public DB key only | `lib/r2.ts` uses `import "server-only"` so a client import fails the build rather than shipping the secret. Client bundle confirmed at 103 kB after adding the AWS SDK. |
| **S4** RLS enabled | Advisor clean apart from `security definer` functions (each self-checks auth) and leaked-password toggle. Verified by impersonation, not superuser session — correct method. |
| **S8** Block field tampering | **Found live and fixed.** `profiles_update` didn't constrain columns; any seeker could `PATCH` their own role to admin via the anon key. Verified exploited state: a seeker self-promoted and read 4,355 of 4,356 applications. Closed by `guard_profile_columns()` in migration 025. |
| **S9** Secure session cookies | Handled by Supabase Auth defaults; no custom cookie handling found that would override this. |
| **S13** Parameterized queries | Migration tooling and app both use Supabase's query builder / parameterized RPC; no raw string-built SQL found. |
| **S15** Escape user content | `lib/sanitize.ts`, allowlist sanitiser on the write side, checked against 11 XSS payloads, applied to all three job body rich-text fields. |
| **S16** Restrict file uploads | R2 archive private, presigned reads only, content-hashed keys. New uploads go to a private Supabase bucket. Public HTTP links explicitly considered and rejected given the data is ~4,000 people's CVs with addresses and ID numbers. |
| **S18** Security headers | CSP with per-request nonce and `strict-dynamic`, HSTS, COOP, XFO, Permissions-Policy already live in `next.config.ts` / `middleware.ts`. |

### Open — action needed

**S5 Encrypt sensitive data** — not confirmed either way in the docs. Check whether any national ID or equivalent field exists in the migrated applicant data (the postmeta map in `02-data-recovery-and-migration.md` doesn't list one, but confirm before closing this).

**S6 Enforce server-side auth** — `requireUser`/`requireProfile` in `lib/auth.ts` appear to be the pattern used everywhere. Confirm no dashboard mutation trusts a client-supplied role or org_id anywhere outside what S8 already fixed.

**S10 Hash passwords** — Supabase Auth default (bcrypt). No custom auth path found. Treat as closed unless a legacy import path is found that bypassed Supabase Auth.

**S11 Rate limit login** — **confirmed absent.** Firewall log shows `Rate Limited –`, `Custom Rules 0`. Sign-in traffic goes straight to Supabase, not through Vercel, so this needs Supabase → Auth → Rate Limits, not a Vercel rule.

**S12 Add bot protection** — provider decided: **Turnstile only**. `components/captcha.tsx`'s hCaptcha branch and the `@hcaptcha/react-hcaptcha` dependency are removed; CSP narrowed to `challenges.cloudflare.com` alone. Code side is done — what's left is external, in this exact order:
1. Get a Turnstile site key from the Cloudflare dashboard.
2. Set `NEXT_PUBLIC_CAPTCHA_SITE_KEY` in Vercel, redeploy, confirm the widget renders and sends a token while Supabase still ignores it.
3. Only then flip Supabase → Auth → Attack Protection to Turnstile.

CSP already allows Turnstile's frame/script/connect origin — confirmed in `middleware.ts`, no further change needed there.

**Postmortem, Aug 2026 Vercel account migration:** captcha silently stayed off on the new project because the var was entered as `NEXT_PUBLIC_CAPTHA_SITE_KEY` (missing the "C") — an exact string match against `process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY`, so the typo'd var is invisible to the app rather than erroring. `captchaConfigured` (`components/captcha.tsx:44`) silently renders nothing when unset, which is correct behavior for local dev but means a typo in Vercel produces no error anywhere — just an absent widget and, once the client-side gate in `login-form.tsx`/`signup-form.tsx` is reached, "Please complete the security check first." When re-adding this var on any future account/project move, copy-paste the name from `components/captcha.tsx` rather than retyping it, and verify by checking page source for a `challenges.cloudflare.com` script tag after deploy — not just that *a* variable with a similar name exists in the dashboard.

**S14 Validate all input** — not audited yet against a schema library (Zod or equivalent) at every API boundary. `lib/job-form.ts` (`parseJobFields`) sanitises rich text but confirm structural validation exists on every server action, not just the rich-text fields.

**S17 Trim API responses** — not audited. Check the ten most-used endpoints for `select('*')` or over-fetching, particularly anything touching `applications` or `profiles`, which carry applicant PII.

---

## Section 2 · Search Visibility (G1–G20)

### Closed

| Item | Status |
|---|---|
| **G20** XML sitemap | `app/sitemap.ts` live, lists only published jobs, enforced by RLS (`jobs_select_published`) rather than by a query filter — so a draft can't leak in even if the `.eq()` is removed. |
| **G19** Search console (partial) | Not confirmed verified yet — sitemap exists and is correct, but domain verification status in Search Console itself isn't stated in the docs. Check this explicitly. |

`app/robots.ts` also exists, disallowing `/admin`, `/dashboard`, `/auth`, `/api` — this is G-adjacent (crawl budget) rather than a numbered G item, but worth noting since it was a direct response to Google being 2.3k of 6.6k daily requests on a two-listing site.

### Open — nothing else in this section is confirmed done

The current docs describe a functioning product but don't mention on-page SEO fundamentals at all, which means these are very likely untouched:

- **G1 Clear H1 titles** — audit every route for exactly one unique H1. `/jobs/[slug]` and the homepage are the ones that matter most for search.
- **G3 SEO page titles** — Next.js metadata export per route, with a root-layout template for the brand suffix. Check `app/jobs/[slug]/page.tsx` in particular; a job detail page with no unique title is losing the most valuable long-tail search traffic this product could get.
- **G4 Meta descriptions** — unique, 150–160 characters, per indexable page.
- **G13 Image alt texts** — audit with axe. The logo, globe (decorative, should be `alt=""` or aria-hidden given it's WebGL canvas), and any job/company images.
- **G14 Privacy policy** — `app/privacy/` exists per the file inventory in `05-current-build-state.md`. Confirm it covers what's collected, why, legal basis, retention, and third-party processors (R2, Supabase) as required under the Kenya Data Protection Act — not just a generic template.
- **G15 Terms and conditions** — `app/terms/page.tsx` now exists, linked from the footer, signup, and the privacy page. **First draft, not reviewed by legal** — content covers acceptable use, posting/moderation, suspension, liability, and governing law, matching what the database actually enforces, but PAC/legal should review before it's treated as binding.
- **G16 Mobile optimization** — the two-pane `/jobs` layout and mobile bottom tab bar suggest this was designed for, but run Google's mobile-friendly test on the homepage, `/jobs`, and a job detail page to confirm.
- **G17 Fast images** — no image optimization strategy mentioned in the docs beyond `next/image` usage implied by the stack. Confirm CV thumbnails (if any) and the logo are served appropriately sized; the logo file itself is 591×221 and cropped via CSS, not re-exported, which is fine for a header/footer logo but worth checking against the 200KB-per-image acceptance test.
- **G18 Google Analytics** — not mentioned anywhere in the docs. If nothing is measuring the funnel, this is a genuine blind spot on a live product. Prefer a cookieless option (Plausible) to avoid triggering C16's consent requirement.

**G5/G6 (service pages, location pages) and G7–G12, G9–G11 are largely not applicable in their literal form** — this is a job board, not a services business with multiple offerings or physical locations. The equivalent concept worth checking: does `/jobs` filter by location in a way that produces indexable, distinct URLs per major city (Nairobi, Mombasa, etc.), which is the job-board version of G6. Currently unclear from the docs whether location filters produce crawlable URLs or are client-side only.

---

## Section 3 · Content & Compliance (C1–C18)

### Closed or partially addressed

- **C1 sitemap.xml submission** — sitemap exists (see G20); submission to Search Console itself not confirmed.
- **C16 Cookie consent** — no analytics tool is currently running per the docs, so there's nothing yet requiring consent. This becomes a blocking prerequisite the moment G18 (Analytics) is implemented — sequence G18 and C16 together, don't ship one without the other.

### Open

- **C4 Site favicon** — explicitly called out as missing in `07-next-steps-and-todos.md` item 18: "There is also still no favicon, because a 591×221 asset would letterbox." Needs a proper square export, not a crop of the existing wordmark. Low effort, currently reads as unfinished on every browser tab.
- **C5 Tap-to-call number** — check whether any phone number appears on `/employers` or a contact surface, and if so whether it's wrapped in a `tel:` link.
- **C6 Form error messages** — `lib/auth-errors.ts` maps Supabase auth errors to human copy and specifically closes a login-enumeration oracle, which is good practice beyond the handbook item. Confirm this pattern extends to the apply form and job-post form, not just auth.
- **C9 Five blog posts minimum** — no blog or content section mentioned anywhere in the file inventory. This is very likely not started. Lower priority than the compliance items below, but flag it as a known gap rather than silently skipping it.
- **C13 Visible contact email / phone** — `it@pac.africa` is on `/employers`, `/privacy`, and now the footer. No real support phone number exists yet; the footer shows an inert "Phone — coming soon" placeholder rather than a dead `tel:` link, per a deliberate decision to add nothing live until there's a real number.
- **C14 Working social links** — no real accounts exist yet. Same placeholder treatment as C13 — inert "coming soon" labels in the footer, not dead `href="#"` anchors.
- **C17 llms.txt** — done. `public/llms.txt` lists what's available for AI retrieval and explicitly excludes applicant/employer data.
- **C18 Terms of service** — done, see G15. First draft, not yet legal-reviewed.

---

## Priority ordering across all three sections

The security section (S) already had most of its work done or closed in v2 — what's left there (S11, S12, S14, S17) is genuinely urgent because it's exploitable right now. The SEO and Content sections are close to untouched, but nothing in them is exploitable; they're revenue and compliance exposure, not breach exposure. Sequence accordingly:

1. **S11, S12** — rate limiting and captcha enforcement. Auth surface is the one still open to abuse.
2. **G15 / C18** — terms of service. If genuinely absent, this is a legal exposure on a product now handling thousands of people's data and employer relationships, and it's cheap to close.
3. **G14 recheck** — confirm the existing privacy policy actually meets DPA requirements rather than assuming it does because the file exists.
4. **C4** — favicon. Ten minutes, visible on every tab, no reason it's still open.
5. **G1, G3, G4** — on-page SEO basics. This is a live job board with real listings; every day without unique titles and descriptions per job is lost organic traffic that compounds.
6. **G18 + C16 together** — analytics and its required consent gate, shipped as one unit.
7. **C17** — llms.txt. Trivial, do whenever convenient.
8. **S14, S17, S5, S6** — the remaining security items that need auditing rather than fixing; likely fine, but unverified.
9. **C9, C13, C14, C5** — content polish items, lowest urgency.

---

## Ground rules (unchanged from v2)

1. Read before you write. Full findings before any PR.
2. No schema changes without a migration file under `migrations/`, following the existing numbered convention (currently at 025).
3. Assume every endpoint is called directly, not through the UI, for anything security-related.
4. Changed files delivered as `.tar.gz`, not the full codebase.
5. This is a live product in active use. A regression is a real outage, not hypothetical risk.

---

## Report format

```markdown
# jobs.pac.africa · Launch Readiness Status · [date]

## Security (S)
[per item: closed / open / fixed this session, with acceptance test result]

## Search Visibility (G)
[per item: closed / open / not applicable, with reasoning for any N/A]

## Content & Compliance (C)
[per item: closed / open, flagging anything legally load-bearing]

## Recommended next session's priority
[top 3 from what's still open]
```

---

## Still out of scope for Claude Code

- **HostPinnacle** — five other production databases on the account that was compromised, security hardening ticket never confirmed resolved. Not a code fix; needs the ticket followed up directly with the host.
- **P0 admin-list audit** (from v2) — five-minute SQL query only Imran should run and interpret:
  ```sql
  select email, role, created_at from public.profiles where role = 'admin' order by created_at;
  ```
  If any of the four admin rows is unfamiliar, treat applicant data as exposed and act under the Kenya DPA's breach-notification duty before anything else on this list matters.
