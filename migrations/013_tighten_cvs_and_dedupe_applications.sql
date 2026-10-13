-- ============================================================
-- 013 — Shrink the anon upload surface, and stop repeat applications
-- ============================================================
-- Two of the abuse vectors raised in the security review. Neither is a
-- general-purpose rate limiter — see the note at the end for that.
--
-- ── 1. Put the cvs bucket back to 5 MB, PDF only ─────────────
-- Migration 009 raised it to 60 MB and allowed doc/docx so the recovered
-- WordPress archive would fit: 913 of those files are Word documents and 30
-- exceed 5 MB, the largest 54.5 MB.
--
-- That archive now lives in Cloudflare R2 instead, so the widening no longer
-- buys anything — and it left `anon` able to push 60 MB files into Supabase
-- Storage through the public apply form, on a 1 GB tier. That is an abuse
-- vector that bills the project directly.
--
-- Back to the constraint that suits what this bucket now actually holds: new
-- applicant CVs, which average ~250 KB. Nothing is orphaned by this — the
-- limits apply to new uploads, not to objects already stored, and the bucket
-- currently holds one object of 0.2 MB.
--
-- The app-side guards in components/apply-form.tsx and
-- app/dashboard/seeker/actions.ts already enforce PDF at 5 MB, so this makes
-- the storage layer agree with them rather than trusting them.
update storage.buckets
   set file_size_limit    = 5242880,  -- 5 MB
       allowed_mime_types = array['application/pdf'],
       public             = false
 where id = 'cvs';

-- ── 2. One application per person per listing ────────────────
-- `applications_insert_public` is open to anon by design, so nothing stopped
-- the same address being filed against the same listing repeatedly — whether by
-- a double-clicked button or a script.
--
-- Partial index: the 4,355 migrated rows all have job_id NULL and are excluded,
-- so this cannot conflict with history. Verified 0 duplicate (job_id, email)
-- pairs before adding it.
--
-- Case-insensitive because applicants type their address however they like, and
-- the WordPress meta was never normalised.
--
-- components/apply-form.tsx already maps 23505 to "You have already applied for
-- this role", so the guest-facing behaviour is a clear message rather than a
-- failure.
--
-- Note what this does and does not do: it stops accidental resubmission and the
-- laziest spam. It does not stop a determined script, which can vary the address
-- per request.
create unique index if not exists applications_one_per_job_email
  on public.applications (job_id, lower(applicant_email))
  where job_id is not null;

-- ── What is still not solved: IP rate limiting ───────────────
-- There is no per-IP throttle on the apply endpoint. The right layer for that is
-- Vercel's WAF rate limiting on /jobs/* and the auth routes, configured in the
-- dashboard — not the database.
--
-- It was considered here and rejected. Postgres can see the caller's IP through
-- current_setting('request.headers')->>'x-forwarded-for' when reached via
-- PostgREST, but that is not observable from the SQL editor, so it cannot be
-- verified the way every other guard in this directory was. Throttling on it
-- would also mean storing or hashing visitor IPs, which is itself personal data
-- and a new retention question. Better to leave the gap documented than to ship
-- an unverified control that looks like protection.
