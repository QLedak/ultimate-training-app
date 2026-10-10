import type { Phase } from "../types";

export type PhaseInfo = {
  phases: Phase[];
  active: Phase;
  index: number; // 0-based position among shown phases
  weekOfPhase: number; // 1..week_count
};

function dayNumber(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86400000);
}

/** The phase the athlete is in today, and which week of it. Null when there is no program. */
export function currentPhaseInfo(all: Phase[], today: string): PhaseInfo | null {
  const phases = all.filter((p) => p.status !== "superseded").sort((a, b) => a.phase_number - b.phase_number);
  if (phases.length === 0) return null;
  const active =
    phases.find((p) => p.status === "active") ??
    phases.find((p) => p.start_date <= today && today <= p.end_date) ??
    null;
  if (!active) return null;
  const raw = Math.floor((dayNumber(today) - dayNumber(active.start_date)) / 7) + 1;
  const weekOfPhase = Math.max(1, Math.min(active.week_count || 1, raw));
  return { phases, active, index: phases.indexOf(active), weekOfPhase };
}
