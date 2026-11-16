import type { Candidate, GeoScope, SimulationResult, UnitResult } from "@votatlas/contracts";
import { uniqueLeader } from "@votatlas/map";

/** UI selection is distinct from persisted engine actions and never changes source records. */
export type GeographicScopeMode = "county" | "multi" | "state";
export interface ScopeSnapshot {
  countyCount: number;
  candidateBallots: number;
  otherBallots: number;
  ballots: number;
  votes: Record<string, number>;
  winnerCandidateId: string | null;
  marginVotes: number;
}
export function normalizedCountyIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
}
export function selectedCountyIds(
  mode: GeographicScopeMode, selectedId: string | null,
  multipleIds: readonly string[], result: SimulationResult
): string[] {
  if (mode === "state") return result.units.map(unit => unit.geoId).sort();
  return mode === "county" ? (selectedId ? [selectedId] : []) : normalizedCountyIds(multipleIds);
}
/** Never emit national for a single loaded state or an empty county selection. */
export function resolveScope(
  mode: GeographicScopeMode, selectedId: string | null,
  multipleIds: readonly string[], result: SimulationResult
): GeoScope | null {
  const stateIds = [...new Set(result.units.map(row => row.stateId))];
  if (mode === "state") {
    if (stateIds.length !== 1) throw new Error("Statewide scope requires one loaded state.");
    return { kind: "state", stateId: stateIds[0]! };
  }
  const ids = selectedCountyIds(mode, selectedId, multipleIds, result);
  if (!ids.length) return null;
  const valid = new Set(result.units.map(row => row.geoId));
  if (ids.some(id => !valid.has(id))) throw new Error("County selection contains an unknown GEOID.");
  return { kind: "county", countyIds: ids };
}
/** Aggregate *engine-produced* atomic rows for contextual display only.
 * Voting and integer allocation remain entirely in @votatlas/sim-core. */
export function summarizeScope(
  result: SimulationResult, ids: readonly string[], candidates: readonly Candidate[]
): ScopeSnapshot {
  const include = new Set(ids);
  const rows: UnitResult[] = result.units.filter(row => include.has(row.geoId));
  const votes: Record<string, number> = Object.fromEntries(candidates.map(c => [c.id, 0]));
  let otherBallots = 0;
  let ballots = 0;
  for (const row of rows) {
    otherBallots += row.otherBallots;
    ballots += row.ballots;
    for (const candidate of candidates) votes[candidate.id]! += row.votes[candidate.id] ?? 0;
  }
  const candidateBallots = candidates.reduce((total, candidate) => total + votes[candidate.id]!, 0);
  if (candidateBallots + otherBallots !== ballots) {
    throw new Error("Engine result aggregation is inconsistent.");
  }
  const winnerCandidateId = uniqueLeader(votes, candidates.map(c => c.id));
  const ranked = candidates.map(c => votes[c.id]!).sort((a, b) => b - a);
  return {
    countyCount: rows.length, votes, ballots, otherBallots, candidateBallots,
    winnerCandidateId,
    marginVotes: winnerCandidateId ? ranked[0]! - (ranked[1] ?? 0) : 0,
  };
}
