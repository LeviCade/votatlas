import { useEffect, useMemo, useState } from "react";
import type { Candidate, GeoScope, SimulationResult } from "@votatlas/contracts";
import type { CohortAction } from "@votatlas/sim-core";
import type { SyntheticModelSession } from "./model-lab";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const eventId = () => "cohort-ui-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()));
interface GroupTotals {
  eligible: number | null;
  ballots: number;
  candidateBallots: number;
  otherBallots: number;
  votes: Record<string, number>;
}
function emptyTotals(candidates: readonly Candidate[]): GroupTotals {
  return { eligible: 0, ballots: 0, candidateBallots: 0, otherBallots: 0,
    votes: Object.fromEntries(candidates.map(c => [c.id, 0])) };
}
type CountCell = { eligibleVoters: number | null; votes: Record<string, number>; otherBallots: number };
function accumulate(totals: GroupTotals, cell: CountCell, candidates: readonly Candidate[]): void {
  totals.eligible = totals.eligible === null || cell.eligibleVoters === null ? null : totals.eligible + cell.eligibleVoters;
  totals.otherBallots += cell.otherBallots;
  for (const candidate of candidates) {
    const votes = cell.votes[candidate.id] ?? 0;
    totals.votes[candidate.id] = (totals.votes[candidate.id] ?? 0) + votes;
    totals.candidateBallots += votes;
  }
  totals.ballots = totals.candidateBallots + totals.otherBallots;
}
export interface ModelLabProps {
  candidates: readonly Candidate[];
  selectedIds: readonly string[];
  scope: GeoScope | null;
  scopeLabel: string;
  ordinary: SimulationResult;
  model: SyntheticModelSession | null;
  generatorReady: boolean;
  canonicalSaveReady: boolean;
  onStart: (seed: string) => boolean;
  onApply: (action: CohortAction) => boolean;
  onUndo: () => void;
  onResetEdits: () => void;
  onExit: () => void;
}
export function ModelLab({
  candidates, selectedIds, scope, scopeLabel, ordinary, model, generatorReady,
  canonicalSaveReady, onStart, onApply, onUndo, onResetEdits, onExit,
}: ModelLabProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [seed, setSeed] = useState("votatlas-fictional-2026");
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [fromId, setFromId] = useState(candidates[0]?.id ?? "");
  const [toId, setToId] = useState(candidates[1]?.id ?? "");
  const [points, setPoints] = useState("3");
  const [factor, setFactor] = useState("0.95");
  const [inputError, setInputError] = useState("");
  useEffect(() => {
    setCohortIds(model ? model.partition.cohorts.slice(0, 1).map(c => c.id) : []);
    setInputError("");
  }, [model?.partition.partitionId]);
  useEffect(() => {
    if (!candidates.some(candidate => candidate.id === fromId)) setFromId(candidates[0]?.id ?? "");
    if (!candidates.some(candidate => candidate.id === toId)) setToId(candidates[1]?.id ?? "");
  }, [candidates, fromId, toId]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedGroups = useMemo(() => new Set(cohortIds), [cohortIds]);
  const totals = useMemo(() => {
    const initial = emptyTotals(candidates), current = emptyTotals(candidates);
    if (model) {
      for (const county of model.partition.counties) {
        if (!selected.has(county.geoId)) continue;
        for (const cell of county.cells) if (selectedGroups.has(cell.cohortId)) accumulate(initial, cell, candidates);
      }
      for (const cell of model.output.cells) {
        if (selected.has(cell.geoId) && selectedGroups.has(cell.cohortId)) accumulate(current, cell, candidates);
      }
    }
    return { initial, current };
  }, [model, selected, selectedGroups, candidates]);
  const eligible = totals.current.eligible === null ? "Unknown" : fmt(totals.current.eligible);
  const actionScope = scope && selectedIds.length > 0 ? scope : null;
  const selectedReady = cohortIds.length > 0 && !!actionScope;
  function transfer() {
    setInputError("");
    const value = Number(points);
    if (!selectedReady) return setInputError("Select a modeled group and one or more Tennessee counties.");
    if (!points.trim() || !Number.isFinite(value) || value <= 0 || value > 100 ||
        !fromId || !toId || fromId === toId)
      return setInputError("Choose distinct candidate IDs and 0–100 positive transfer percentage points.");
    onApply({ type: "COHORT_TRANSFER_PP", id: eventId(), scope: actionScope!,
      cohortIds: [...cohortIds].sort(), fromCandidateId: fromId, toCandidateId: toId, points: value });
  }
  function turnout() {
    setInputError("");
    const value = Number(factor);
    if (!selectedReady) return setInputError("Select a modeled group and one or more Tennessee counties.");
    if (!factor.trim() || !Number.isFinite(value) || value < 0 || value > 10)
      return setInputError("Turnout factor must be between 0 and 10. Eligibility limits still apply.");
    onApply({ type: "COHORT_TURNOUT_SCALE", id: eventId(), scope: actionScope!,
      cohortIds: [...cohortIds].sort(), factor: value });
  }
  return (
    <section className="model-lab" aria-label="Synthetic Model Lab">
      <span className="eyebrow">EXPERIMENTAL · SYNTHETIC ONLY</span>
      <h3>Synthetic Model Lab</h3>
      <p className="model-caution"><strong>Not observed voting behavior.</strong> All modeled cohort memberships, turnout assumptions and candidate preferences are fictional. They are not demographic estimates, surveys or historical election observations.</p>
      {!model ? <>
        <p className="help-text">Opt in to one disjoint partition generated by the canonical simulation package. It must reconstruct every pre-model county and candidate ballot exactly. Overlapping demographic sliders are not supported.</p>
        <label className="model-opt-in"><input type="checkbox" checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)} />
          <span>I understand this is an explicitly hypothetical model, not measured voter preferences.</span></label>
        <label htmlFor="model-seed">Fictional demo seed</label>
        <input id="model-seed" maxLength={128} value={seed} onChange={event => setSeed(event.target.value)} />
        <button type="button" className="action-button" disabled={!acknowledged || !generatorReady || !seed.trim()}
          onClick={() => { if (onStart(seed.trim())) setInputError(""); }}>Start synthetic model <span>↗</span></button>
        {!generatorReady && <p className="model-save-warning" data-testid="model-unavailable">
          The canonical fictional cohort generator from Engineer #2 is not yet integrated. No locally invented demographic partition will be used.
        </p>}
      </> : <>
        <div className="model-metadata">
          <strong>Modeled partition: {model.partition.partitionId}</strong>
          <small>One {model.partition.kind === "joint" ? "explicit joint cross-tabulation" : "single-dimension disjoint partition"} · {model.partition.dimensionIds.join(", ")}</small>
          <small>Seed: {model.seed} · 95 Tennessee counties · post-classic baseline verified</small>
        </div>
        <p className="help-text">Current adjustment geography: <strong data-testid="model-area">{scopeLabel}</strong>. Use the real map or accessible county selector to change the area without rebuilding the model.</p>
        <fieldset className="model-cohort-choices">
          <legend>Select fictional groups to model</legend>
          {model.partition.cohorts.map(group =>
            <label className="model-group-choice" key={group.id}>
              <input type="checkbox" checked={cohortIds.includes(group.id)} onChange={event =>
                setCohortIds(current => event.target.checked ? [...new Set([...current, group.id])].sort()
                  : current.filter(id => id !== group.id))} />
              <span><strong>{group.label}</strong><small>{Object.entries(group.dimensions).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small></span>
            </label>)}
        </fieldset>
        <div className="model-kpis" aria-live="polite">
          <div><span>Selected cohort ballots</span><strong data-testid="model-ballots">{fmt(totals.current.ballots)}</strong>
            <small data-testid="model-ballot-delta">{totals.current.ballots - totals.initial.ballots >= 0 ? "+" : ""}{fmt(totals.current.ballots - totals.initial.ballots)} vs pre-model</small></div>
          <div><span>Modeled eligible capacity</span><strong data-testid="model-eligible">{eligible}</strong>
            <small>Fictional capacity, not eligible-voter observation</small></div>
          <div><span>Candidate vote denominator</span><strong data-testid="model-candidate-ballots">{fmt(totals.current.candidateBallots)}</strong>
            <small>{fmt(totals.current.otherBallots)} other ballots excluded from transfer rate</small></div>
        </div>
        <div className="model-candidates" aria-label="Selected modeled subgroup results">
          {candidates.map(candidate => {
            const v = totals.current.votes[candidate.id] ?? 0;
            const before = totals.initial.votes[candidate.id] ?? 0;
            const diff = v - before;
            return <div key={candidate.id} className="model-candidate-row">
              <span><i style={{ backgroundColor: candidate.color }} />{candidate.name}</span>
              <strong data-testid={`model-votes-${candidate.id}`}>{fmt(v)}</strong>
              <small data-testid={`model-delta-${candidate.id}`}>{diff === 0 ? "baseline" : `${diff > 0 ? "+" : ""}${fmt(diff)} vs pre-model`}</small>
            </div>;
          })}
        </div>
        <p className="help-text">Cohort transfer points are a percentage of selected cohort <strong>candidate ballots</strong>, not all eligible people or other ballots. Invalid donor capacity or eligible turnout is rejected by the engine.</p>
        <div className="form-rule" />
        <h4>Shift hypothetical candidate support</h4>
        <label htmlFor="model-from">From candidate</label>
        <select id="model-from" value={fromId} onChange={event => setFromId(event.target.value)}>
          {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
        <label htmlFor="model-to">To candidate</label>
        <select id="model-to" value={toId} onChange={event => setToId(event.target.value)}>
          {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
        <label htmlFor="model-points">Transfer modeled support (percentage points)</label>
        <input id="model-points" type="number" min="0.1" max="100" step="0.1" value={points}
          onChange={event => setPoints(event.target.value)} />
        <button type="button" className="action-button" disabled={!selectedReady} onClick={transfer}>Apply COHORT_TRANSFER_PP</button>
        <div className="form-rule" />
        <h4>Change modeled group turnout</h4>
        <label htmlFor="model-turnout">Modeled turnout multiplier</label>
        <input id="model-turnout" type="number" min="0" max="10" step="0.01" value={factor}
          onChange={event => setFactor(event.target.value)} />
        <button type="button" className="outline-button" disabled={!selectedReady} onClick={turnout}>Apply COHORT_TURNOUT_SCALE</button>
        <p className="help-text">Changes apply only to selected groups within the active area. Other groups and unselected counties retain their previous counts.</p>
        {inputError && <p role="alert" className="scenario-error">{inputError}</p>}
        <div className="model-action-toolbar">
          <strong>{model.actions.length} modeled action(s)</strong>
          <button type="button" disabled={!model.actions.length} onClick={onUndo}>Undo model action</button>
          <button type="button" disabled={!model.actions.length} onClick={onResetEdits}>Reset model edits</button>
          <button type="button" onClick={onExit}>Exit model and restore ordinary results</button>
        </div>
        <p className={canonicalSaveReady ? "help-text" : "model-save-warning"} data-testid="model-persistence">
          {canonicalSaveReady
            ? "Canonical source-bound v3 project saving is available. Exports include this partition, all model actions, custom candidates and the ordinary scenario."
            : "Model save/load is DISABLED until Engineer #2's canonical v3 project codec is integrated. Ordinary v2 export would lose model actions and is therefore unavailable while modeling."}
        </p>
      </>}
      <p className="model-footer-note">The current loaded election is Tennessee synthetic data, not official 2024 county returns. No demographic preference is inferred from the map.</p>
    </section>
  );
}
