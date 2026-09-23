-- Fixes a real bug hit while deleting a test athlete: several foreign keys
-- reference macrocycle_phases(id) or program_drafts(id) with no ON DELETE
-- behavior (defaults to NO ACTION/RESTRICT). The referencing ROWS are
-- always deleted together with their athlete anyway (via their own direct
-- athlete_id -> athletes ON DELETE CASCADE, or transitively through
-- skeleton_id/phase_id cascades) -- but because Postgres doesn't guarantee
-- an order between independent cascade paths within one statement, deleting
-- an athlete can still hit a foreign-key violation on one of these links
-- before the referencing row is itself removed.
--
-- The one exception is corpus_entries: per corpus-retrieval-spec.md and
-- review-approval-flow-spec.md, corpus entries are explicitly designed to
-- persist independently of their originating draft/athlete ("nothing is
-- hard-deleted", "the pool accumulates across phases and other athletes").
-- So that one gets ON DELETE SET NULL instead of CASCADE -- the entry
-- survives, it just loses its now-meaningless link to a deleted draft.

-- phase_performance_summaries.phase_id -> macrocycle_phases(id)
alter table phase_performance_summaries
  drop constraint if exists phase_performance_summaries_phase_id_fkey;
alter table phase_performance_summaries
  add constraint phase_performance_summaries_phase_id_fkey
  foreign key (phase_id) references macrocycle_phases(id) on delete cascade;

-- program_drafts.phase_id -> macrocycle_phases(id)
alter table program_drafts
  drop constraint if exists program_drafts_phase_id_fkey;
alter table program_drafts
  add constraint program_drafts_phase_id_fkey
  foreign key (phase_id) references macrocycle_phases(id) on delete cascade;

-- macrocycle_skeletons.source_draft_id -> program_drafts(id)
-- (originally added as a separately-named constraint, not the auto-generated name)
alter table macrocycle_skeletons
  drop constraint if exists macrocycle_skeletons_source_draft_fk;
alter table macrocycle_skeletons
  add constraint macrocycle_skeletons_source_draft_fk
  foreign key (source_draft_id) references program_drafts(id) on delete cascade;

-- scheduled_sessions.phase_id -> macrocycle_phases(id)
alter table scheduled_sessions
  drop constraint if exists scheduled_sessions_phase_id_fkey;
alter table scheduled_sessions
  add constraint scheduled_sessions_phase_id_fkey
  foreign key (phase_id) references macrocycle_phases(id) on delete cascade;

-- scheduled_sessions.source_draft_id -> program_drafts(id)
alter table scheduled_sessions
  drop constraint if exists scheduled_sessions_source_draft_id_fkey;
alter table scheduled_sessions
  add constraint scheduled_sessions_source_draft_id_fkey
  foreign key (source_draft_id) references program_drafts(id) on delete cascade;

-- testing_day_results.phase_id -> macrocycle_phases(id)
alter table testing_day_results
  drop constraint if exists testing_day_results_phase_id_fkey;
alter table testing_day_results
  add constraint testing_day_results_phase_id_fkey
  foreign key (phase_id) references macrocycle_phases(id) on delete cascade;

-- corpus_entries.source_draft_id -> program_drafts(id)  (the exception: SET NULL, not CASCADE)
alter table corpus_entries
  alter column source_draft_id drop not null;
alter table corpus_entries
  drop constraint if exists corpus_entries_source_draft_id_fkey;
alter table corpus_entries
  add constraint corpus_entries_source_draft_id_fkey
  foreign key (source_draft_id) references program_drafts(id) on delete set null;
