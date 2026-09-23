-- Adds "abdominal" to the injury location vocabulary (intake screening is
-- being simplified to checkbox-only, which also adds this new option to
-- both the current-injury and injury-history lists).
alter table athlete_injury_reports
  drop constraint if exists athlete_injury_reports_location_check;

alter table athlete_injury_reports
  add constraint athlete_injury_reports_location_check
  check (
    location in ('achilles_calf','patellar_knee','acl_knee','hamstring',
                 'groin_adductor','abdominal','shoulder','lower_back','ankle','other')
  );

-- Note: 'other' is left in the accepted set for backward compatibility with
-- any rows already stored that used it, even though the simplified
-- checkbox-only intake UI no longer offers it going forward.
