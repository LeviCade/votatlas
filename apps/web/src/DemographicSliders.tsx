import { useEffect, useMemo, useState } from "react";
import type { Candidate, GeoScope } from "@votatlas/contracts";
import type { CohortAction } from "@votatlas/sim-core";
import type { SyntheticModelSession } from "./model-lab";

const fmt = (value: number): string => new Intl.NumberFormat("en-US").format(value);
const id = (): string => "slider-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const pct = (votes: number, total: number): number => total ? 100 * votes / total : 0;

export interface ModeledSupportTotals {
  candidateBallots: number;
  ballots: number;
  otherBallots: number;
  votes: Record<string, number>;
}
export function selectedModeledSupport(
  model: SyntheticModelSession, countyIds: readonly string[], cohortIds: readonly string[],
  candidates: readonly Candidate[],
): ModeledSupportTotals {
  const geos = new Set(countyIds), groups = new Set(cohortIds);
  const votes = Object.fromEntries(candidates.map(c => [c.id, 0]));
  let otherBallots = 0;
  for (const cell of model.output.cells) {
    if (!geos.has(cell.geoId) || !groups.has(cell.cohortId)) continue;
    otherBallots += cell.otherBallots;
    for (const candidate of candidates) votes[candidate.id]! += cell.votes[candidate.id] ?? 0;
  }
  const candidateBallots = candidates.reduce((sum, c) => sum + votes[c.id]!, 0);
  return { candidateBallots, ballots: candidateBallots + otherBallots, otherBallots, votes };
}

/** UI-only action translation. All integer allocation, capacity, replay and conservation
 * remain exclusively inside @votatlas/sim-core. */
export function supportTargetAction(
  totals: ModeledSupportTotals, targetId: string, targetPercent: number,
  donorId: string, recipientId: string, scope: GeoScope,
  cohortIds: readonly string[], candidates: readonly Candidate[],
): CohortAction {
  const allowed = new Set(candidates.map(c => c.id));
  if (!allowed.has(targetId) || !allowed.has(donorId) || !allowed.has(recipientId))
    throw new Error("Select valid modeled candidates.");
  if (!Number.isFinite(targetPercent) || targetPercent < 0 || targetPercent > 100)
    throw new Error("Hypothetical support must be between 0 and 100 percent.");
  if (totals.candidateBallots <= 0) throw new Error("No modeled candidate ballots in this selected area/group.");
  if (cohortIds.length === 0 || !scope || !["county", "state"].includes(scope.kind))
    throw new Error("Select one disjoint group and one or more Tennessee counties.");
  const current = pct(totals.votes[targetId] ?? 0, totals.candidateBallots);
  const diff = targetPercent - current;
  if (Math.abs(diff) < 0.0001) throw new Error("Move a support slider to change modeled candidate preference.");
  const raising = diff > 0;
  const fromCandidateId = raising ? donorId : targetId;
  const toCandidateId = raising ? targetId : recipientId;
  if (fromCandidateId === toCandidateId) throw new Error("Choose a different donor or recipient candidate.");
  const points = Math.abs(diff);
  // A TRANSFER_PP rate is a share of *candidate ballots*, not Census population,
  // eligible residents, or observed election votes.
  const available = pct(totals.votes[fromCandidateId] ?? 0, totals.candidateBallots);
  if (points > available + 1e-8)
    throw new Error(`The modeled donor has ${available.toFixed(2)}% capacity, below the requested ${points.toFixed(2)} points.`);
  return {
    id: id(), type: "COHORT_TRANSFER_PP", scope,
    cohortIds: [...new Set(cohortIds)].sort(), fromCandidateId, toCandidateId, points,
  };
}

export interface DemographicSlidersProps {
  model: SyntheticModelSession;
  candidates: readonly Candidate[];
  selectedIds: readonly string[];
  cohortIds: readonly string[];
  scope: GeoScope | null;
  onApply: (action: CohortAction) => boolean;
}

export function DemographicSliders({ model, candidates, selectedIds, cohortIds, scope, onApply }: DemographicSlidersProps) {
  const totals = useMemo(() => selectedModeledSupport(model, selectedIds, cohortIds, candidates),
    [model, selectedIds, cohortIds, candidates]);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [donorId, setDonorId] = useState(candidates[1]?.id ?? candidates[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(candidates[1]?.id ?? candidates[0]?.id ?? "");
  const [error, setError] = useState("");
  const key = `${model.partition.partitionId}:${model.actions.length}:${selectedIds.join(",")}:${cohortIds.join(",")}`;
  useEffect(() => {
    setTargets(Object.fromEntries(candidates.map(c => [c.id,
      Math.round(pct(totals.votes[c.id] ?? 0, totals.candidateBallots) * 10) / 10])));
    setError("");
  // A fresh object of numeric totals must not re-trigger this setter after every render.
  // The stable selection/action key captures when an applied engine state changes.
  }, [key]);
  useEffect(() => {
    const ids = candidates.map(c => c.id);
    setDonorId(current => ids.includes(current) ? current : ids[1] ?? ids[0] ?? "");
    setRecipientId(current => ids.includes(current) ? current : ids[1] ?? ids[0] ?? "");
  }, [candidates]);
  const ready = scope !== null && cohortIds.length > 0 && totals.candidateBallots > 0;
  function applyCandidate(candidateId: string) {
    setError("");
    if (!scope) { setError("Select at least one Tennessee county first."); return; }
    try {
      const action = supportTargetAction(totals, candidateId, targets[candidateId] ?? NaN,
        donorId, recipientId, scope, cohortIds, candidates);
      onApply(action);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid modeled candidate support."); }
  }
  return (
    <section className="demographic-sliders" aria-label="Hypothetical candidate support sliders">
      <div className="slider-section-head">
        <div><span className="eyebrow">HYPOTHETICAL ELECTORATE ASSUMPTIONS</span><h4>Candidate support sliders</h4></div>
        <span className="slider-counter">{fmt(totals.candidateBallots)} modeled candidate ballots</span>
      </div>
      <p className="help-text">Each slider proposes a fictional candidate share <strong>within selected cohort candidate ballots</strong>.
        Apply a proposal to transfer support between two candidates; the authoritative engine conserves votes.
        These values are <strong>not observed subgroup voting preferences</strong>.</p>
      <div className="slider-donor-row">
        <label htmlFor="slider-donor">Draw increased support from</label>
        <select id="slider-donor" value={donorId} onChange={event => setDonorId(event.target.value)}>
          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label htmlFor="slider-recipient">Send decreased support to</label>
        <select id="slider-recipient" value={recipientId} onChange={event => setRecipientId(event.target.value)}>
          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="slider-candidate-stack">
        {candidates.map(candidate => {
          const current = pct(totals.votes[candidate.id] ?? 0, totals.candidateBallots);
          const target = targets[candidate.id] ?? Math.round(current * 10) / 10;
          const different = Math.abs(target - current) >= .05;
          const increasing = target > current;
          const from = increasing ? donorId : candidate.id;
          const to = increasing ? candidate.id : recipientId;
          const possible = ready && different && from !== to &&
            Math.abs(target - current) <= pct(totals.votes[from] ?? 0, totals.candidateBallots) + 1e-8;
          return (
            <div className="demographic-slider-card" key={candidate.id}>
              <div className="demographic-slider-heading">
                <span><i style={{backgroundColor:candidate.color}} aria-hidden="true"/>{candidate.name}</span>
                <strong data-testid={`current-support-${candidate.id}`}>{current.toFixed(1)}% now</strong>
              </div>
              <div className="demographic-slider-track">
                <input type="range" min="0" max="100" step="0.1" disabled={!ready}
                  aria-label={`Hypothetical support for ${candidate.name}`}
                  value={target} onChange={event =>
                    setTargets(previous => ({...previous,[candidate.id]:Number(event.target.value)}))}/>
                <div className="demographic-target-input">
                  <label htmlFor={`target-${candidate.id}`}>Proposed %</label>
                  <input id={`target-${candidate.id}`} type="number" min="0" max="100" step="0.1"
                    aria-label={`Proposed support percent for ${candidate.name}`}
                    value={target} onChange={event =>
                      setTargets(previous => ({...previous,[candidate.id]:Number(event.target.value)}))}/>
                </div>
              </div>
              <div className="demographic-slider-bottom">
                <small data-testid={`support-delta-${candidate.id}`}>
                  {different ? `${target > current ? "+" : ""}${(target-current).toFixed(1)} percentage points proposed`
                    : "Unchanged hypothetical share"}
                </small>
                <button type="button" disabled={!possible} onClick={() => applyCandidate(candidate.id)}
                  aria-label={`Apply modeled support for ${candidate.name}`}>Apply support</button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="scenario-error" role="alert">{error}</p>}
      <p className="help-text">Candidate percentages describe the current modeled distribution. Proposed sliders do not change results until Apply.
        An edit changes only its donor and recipient; other candidates and counties stay untouched.</p>
    </section>
  );
}
