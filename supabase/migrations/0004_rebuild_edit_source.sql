-- Supports athlete-initiated rebuilds (data-architecture-spec.md step 7
-- (b)/(c)): a new program_drafts version created because an athlete
-- requested a plan update mid-phase (schedule change, injury/pain, or other),
-- not because the coach edited a draft via chat or a direct field override.
-- program_drafts.edit_source only allowed 'chat' | 'direct_override' —
-- broadening it to include 'rebuild' so these drafts are distinguishable in
-- the review UI/history from a coach-initiated edit.
--
-- Run this in the Supabase SQL editor after the prior migrations.

alter table program_drafts drop constraint if exists program_drafts_edit_source_check;
alter table program_drafts
  add constraint program_drafts_edit_source_check
  check (edit_source in ('chat', 'direct_override', 'rebuild'));
