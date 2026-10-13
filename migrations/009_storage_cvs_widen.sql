-- ============================================================
-- 009 — Widen the cvs bucket for the recovered archive
-- ============================================================
-- Migration 007 created `cvs` for NEW uploads through the apply form, where
-- PDF-only at 5 MB is the right constraint: it is a public, unauthenticated
-- endpoint, and bounding it at the storage layer is what stops it being used as
-- general-purpose file hosting.
--
-- The recovered archive does not fit those limits, and it is real applicant
-- history rather than new input:
--
--   4,431 .pdf     1,779 MB
--     846 .docx       83 MB
--      67 .doc        20 MB
--   -----------------------
--   5,346 files   1,883 MB
--
--   30 files exceed 5 MB; the largest is 54.5 MB.
--
-- Rejecting 913 Word CVs would mean discarding a decade of applications from
-- people who submitted the format the old site accepted. So the bucket accepts
-- doc and docx, and the cap rises to 60 MB to clear the largest file.
--
-- The bucket stays PRIVATE. Everything is still reachable only through the
-- policies in 007: the uploader, the applicant who owns the application, an
-- employer who owns the job, or an admin.
--
-- TRADE-OFF, stated plainly: this also raises the ceiling on what an anonymous
-- visitor can push through the public apply form, from 5 MB PDF-only to 60 MB
-- including Word. The app-side guards in components/apply-form.tsx and
-- app/dashboard/seeker/actions.ts still enforce PDF-only at 5 MB for new
-- submissions, so the practical limit for new uploads is unchanged — but the
-- storage layer is no longer the thing enforcing it. If that matters more than
-- the Word history, revert this and migrate PDFs only.
-- ============================================================

update storage.buckets
   set file_size_limit    = 62914560,  -- 60 MB
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ],
       public             = false
 where id = 'cvs';

-- Verify: expect one row, public=false, 62914560, three mime types.
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'cvs';
