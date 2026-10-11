import React, { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorText, H1, Loading, P, Screen } from "../components/ui";
import { SeasonFields } from "../components/SeasonFields";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { commitmentsPayload, normalizeCommitments, normalizeTournaments, validateScheduleForm, type Commitment, type Tournament } from "../lib/schedule.core";
import { colors } from "../theme";

type ScheduleResponse = {
  season_over: boolean;
  season_start: string | null;
  season_end: string | null;
  recurring_commitments: unknown;
  tournament_weekends: unknown;
};

export default function SeasonScreen() {
  const { athlete } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [seasonOver, setSeasonOver] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!athlete) return;
    try {
      const d = await api<ScheduleResponse>(`/api/athletes/${athlete.id}/schedule`);
      setStart(d.season_start ?? "");
      setEnd(d.season_end ?? "");
      setTournaments(normalizeTournaments(d.tournament_weekends));
      setCommitments(normalizeCommitments(d.recurring_commitments));
      setSeasonOver(!!d.season_over);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [athlete]);
  useEffect(() => { load(); }, [load]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setMessage(null); };

  async function save() {
    if (!athlete) return;
    setError(null);
    setMessage(null);
    const problem = validateScheduleForm({ season_start: start, season_end: end, tournaments, commitments });
    if (problem) return setError(problem);
    setSaving(true);
    try {
      const d = await api<{ message?: string }>(`/api/athletes/${athlete.id}/schedule`, {
        method: "PATCH",
        body: {
          season_start: start,
          season_end: end,
          tournament_weekends: tournaments,
          recurring_commitments: commitmentsPayload(commitments),
        },
      });
      setMessage(d.message ?? "Saved.");
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded && !error) return <Screen><Loading /></Screen>;

  return (
    <Screen>
      <H1>Season & game days</H1>
      <P muted>Keep your season dates, tournaments and weekly game or league nights current so your program plans around them.</P>
      {seasonOver ? (
        <Card tone="amber">
          <P>Your last season has ended. Planning your next season is done on the website under "Plan next season". Your coach builds your next plan from it.</P>
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {message ? <Card tone="green"><P>{message}</P></Card> : null}

      {loaded && !seasonOver ? (
        <>
          <SeasonFields
            start={start}
            end={end}
            tournaments={tournaments}
            commitments={commitments}
            onStart={edit(setStart)}
            onEnd={edit(setEnd)}
            onTournaments={edit(setTournaments)}
            onCommitments={edit(setCommitments)}
          />

          <Button title="Save schedule" onPress={save} loading={saving} disabled={!dirty} />
        </>
      ) : null}
    </Screen>
  );
}
