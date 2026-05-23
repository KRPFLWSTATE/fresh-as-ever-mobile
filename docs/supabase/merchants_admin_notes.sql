-- Additive migration: add `admin_notes` to `public.merchants`
--
-- Status: APPLIED to project `odkbpeelvcdmlimdflbr` (migration name `merchants_admin_notes`).
--
-- Used by `AdminApplicationReviewScreen`'s "Request info" workflow so admin notes are kept
-- separate from `rejection_reason`. Notes are appended (timestamped) rather than overwritten.

alter table public.merchants
  add column if not exists admin_notes text;

comment on column public.merchants.admin_notes is
  'Free-form notes from admin review (Request Info workflow). Separate from rejection_reason.';
