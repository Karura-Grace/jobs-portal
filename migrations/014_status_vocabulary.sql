-- ============================================================
-- 014 — Two workflow states the product needs
-- ============================================================
-- The frontend brief uses status names the schema had nowhere to put:
--
--   Applied / Under Review   -> we had only `pending`
--   Active / Paused          -> we had `published`, with no pause
--   Director                 -> the enum says `executive`
--
-- Only two of those are genuinely missing states rather than naming choices:
--
--   under_review  An employer has opened the application and is considering it.
--                 Without it, "Applied" and "Under Review" would be the same
--                 row wearing two labels, and an applicant could not tell
--                 whether anyone had looked.
--
--   paused        A listing temporarily off the site without being closed.
--                 Closing it implies the role is filled or withdrawn; pausing
--                 says "still hiring, stop the inbox for now". Employers ask
--                 for this constantly and the only alternative was to close and
--                 repost, which loses the applicant thread.
--
-- The rest are labels, handled in lib/content.ts, not here:
--   pending   -> "Applied"
--   published -> "Active"
--   executive -> "Director"
--
-- Renaming executive was rejected: the value is referenced by seeded rows and
-- by RLS policy text, and a display label costs nothing.
--
-- Note on ordering: ADD VALUE ... AFTER keeps the enum in workflow order, so
-- `order by status` sorts the way a human would read it.
-- ============================================================

alter type public.application_status add value if not exists 'under_review' after 'pending';
alter type public.job_status         add value if not exists 'paused'       after 'published';

-- Verify:
--   select unnest(enum_range(null::public.application_status));
--   select unnest(enum_range(null::public.job_status));
