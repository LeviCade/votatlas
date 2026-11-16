import { useMemo, useState } from "react";
import type {
  Adjustment, Candidate, ElectionDefinition, GeoScope, Scenario, SimulationResult, UnitResult,
} from "@votatlas/contracts";
import { MapCanvas, paintCounties, uniqueLeader } from "@votatlas/map";
import type { CountyShapes } from "@votatlas/map";
import type { CountyReference } from "@votatlas/data";
import { SchematicAtlas } from "./SchematicAtlas";

type TabName = "Election" | "Candidates" | "Local" | "Style";
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const percentOf = (votes: number, total: number) => total > 0 ? 100 * votes / total : 0;
const actionId = () => "ui-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()));

export interface DashboardProps {
  election: ElectionDefinition;
  result: SimulationResult;
  baseline: SimulationResult;
  references: readonly CountyReference[];
  scenario: Scenario;
  geometry?: CountyShapes | null;
  onAdjustment: (action: Adjustment) => void;
  onUndo: () => void;
  onReset: () => void;
  onExport: () => string;
  onImport: (raw: string) => boolean;
  error: string;
  message: string;
}
function CandidateKey({ candidate }: { candidate: Candidate }) {
  return <span className="candidate-key"><i style={{ backgroundColor: candidate.color }} aria-hidden="true" />{candidate.name}</span>;
}
function CandidateScore({ candidate, votes, baselineVotes, total }: { candidate: Candidate; votes: number; baselineVotes: number; total: number }) {
  const delta = votes - baselineVotes;
  const share = percentOf(votes, total);
  return (
    <div className="score-item" data-testid="candidate-score">
      <div className="score-head">
        <span className="score-dot" style={{ background: candidate.color }} aria-hidden="true" />
        <span className="score-name">{candidate.name}</span>
        <span className="score-share">{share.toFixed(1)}%</span>
      </div>
      <div className="score-meta"><span>{candidate.partyLabel ?? "Unaffiliated"}</span><div className="state-votes"><strong data-testid={`state-votes-${candidate.id}`}>{formatNumber(votes)} votes</strong><small data-testid={`state-delta-${candidate.id}`} className={delta < 0 ? "state-delta negative" : "state-delta"}>{delta === 0 ? "baseline" : `${delta > 0 ? "+" : ""}${formatNumber(delta)} vs baseline`}</small></div></div>
      <div className="score-meter"><span style={{ width: share + "%", backgroundColor: candidate.color }} /></div>
    </div>
  );
}
function UnitDetails({ unit, baselineUnit, countyName, candidates }: {
  unit: UnitResult | null; baselineUnit: UnitResult | null; countyName: string; candidates: Candidate[];
}) {
  if (!unit) return <p className="empty-detail">Select a county on the map or in the searchable list.</p>;
  const candidateBallots = candidates.reduce((total, c) => total + (unit.votes[c.id] ?? 0), 0);
  const winnerId = uniqueLeader(unit.votes, candidates.map((c) => c.id));
  return (
    <section className="unit-details" aria-live="polite" aria-label="County details">
      <div className="unit-header"><div><span className="eyebrow">Selected county · FIPS {unit.geoId}</span><h3>{countyName}</h3></div><span className="detail-tag">{winnerId ? "Unique leader" : "Tie / no votes"}</span></div>
      <div className="unit-columns"><span>Candidate ballots <b>{formatNumber(candidateBallots)}</b></span><span>Other ballots <b>{formatNumber(unit.otherBallots)}</b></span></div>
      {candidates.map((candidate) => (
        <div key={candidate.id} className="unit-row">
          <CandidateKey candidate={candidate} />
          <strong>{percentOf(unit.votes[candidate.id] ?? 0, candidateBallots).toFixed(1)}%</strong>
          <span className="unit-vote-value"><span data-testid={`county-votes-${candidate.id}`}>{formatNumber(unit.votes[candidate.id] ?? 0)}</span>
          <small data-testid={`county-delta-${candidate.id}`} className={(unit.votes[candidate.id] ?? 0) - (baselineUnit?.votes[candidate.id] ?? 0) < 0 ? "vote-delta negative" : "vote-delta"}>{(unit.votes[candidate.id] ?? 0) === (baselineUnit?.votes[candidate.id] ?? 0) ? "baseline" : `${(unit.votes[candidate.id] ?? 0) > (baselineUnit?.votes[candidate.id] ?? 0) ? "+" : ""}${formatNumber((unit.votes[candidate.id] ?? 0) - (baselineUnit?.votes[candidate.id] ?? 0))}`}</small></span>
        </div>
      ))}
      <p className="help-text">Shares use candidate ballots only. Other ballots are listed separately.</p>
    </section>
  );
}
export function Dashboard({ election, result, baseline, references, scenario, geometry, onAdjustment, onUndo, onReset, onExport, onImport, error, message }: DashboardProps) {
  const candidates = [...election.candidates].sort((a, b) => a.ballotOrder - b.ballotOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("Local");
  const [scopeChoice, setScopeChoice] = useState<"county" | "state">("county");
  const [fromCandidateId, setFromCandidateId] = useState(candidates[0]?.id ?? "");
  const [toCandidateId, setToCandidateId] = useState(candidates[1]?.id ?? candidates[0]?.id ?? "");
  const [points, setPoints] = useState("5");
  const [targetCandidateId, setTargetCandidateId] = useState(candidates[0]?.id ?? "");
  const [targetShare, setTargetShare] = useState("40");
  const [turnoutFactor, setTurnoutFactor] = useState("1.05");
  const [showResults, setShowResults] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [scenarioJson, setScenarioJson] = useState("");
  const painted = useMemo(() => geometry ? paintCounties(geometry, result, candidates, showResults) : null, [geometry, result, election.candidates, showResults]);
  const selectedShape = references.find((ref) => ref.geoId === selectedId);
  const selectedUnit = result.units.find((unit) => unit.geoId === selectedId) ?? null;
  const baselineUnit = baseline.units.find((unit) => unit.geoId === selectedId) ?? null;
  const hoveredShape = references.find((ref) => ref.geoId === hoveredId);
  const stateId = selectedUnit?.stateId ?? result.units[0]?.stateId ?? "47";
  const stateTotals = result.byState[stateId] ?? result.national;
  const baselineTotals = baseline.byState[stateId] ?? baseline.national;
  const candidateBallots = candidates.reduce((total, c) => total + (stateTotals.votes[c.id] ?? 0), 0);
  const filteredCounties = references.filter((county) =>
    (county.name + " " + county.geoId).toLowerCase().includes(search.toLowerCase().trim()));
  const scope = (): GeoScope | null => scopeChoice === "state"
    ? { kind: "state", stateId }
    : selectedId ? { kind: "county", countyIds: [selectedId] } : null;

  function sendAdjustment(make: (resolvedScope: GeoScope) => Adjustment | null) {
    const resolvedScope = scope();
    if (!resolvedScope) { setActionMessage("Select a county first, or switch the scope to Tennessee."); return; }
    const next = make(resolvedScope);
    if (!next) return;
    setActionMessage("");
    onAdjustment(next);
  }
  function submitTransfer() {
    const value = Number(points);
    if (!Number.isFinite(value) || value <= 0 || value > 100 || fromCandidateId === toCandidateId) {
      setActionMessage("Use two different candidates and a transfer greater than 0 and at most 100 points."); return;
    }
    sendAdjustment((resolvedScope) => ({
      id: actionId(), type: "TRANSFER_PP", scope: resolvedScope,
      fromCandidateId, toCandidateId, points: value,
    }));
  }
  function submitShare() {
    const value = Number(targetShare);
    if (!Number.isFinite(value) || value < 0 || value > 100 || !targetCandidateId) {
      setActionMessage("Target share must be between 0 and 100%."); return;
    }
    sendAdjustment((resolvedScope) => ({
      id: actionId(), type: "SET_SHARE", scope: resolvedScope,
      candidateId: targetCandidateId, targetPercent: value,
      redistribution: { kind: "proportional-other" },
    }));
  }
  function submitTurnout() {
    const value = Number(turnoutFactor);
    if (!Number.isFinite(value) || value <= 0 || value > 10) {
      setActionMessage("Turnout multiplier must be greater than 0 and at most 10."); return;
    }
    sendAdjustment((resolvedScope) => ({
      id: actionId(), type: "TURNOUT_SCALE", scope: resolvedScope,
      factor: value, allocation: "proportional-candidates",
    }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><span>V</span></div><div><strong>votatlas</strong><small>THE ELECTION SANDBOX</small></div></div>
        <div className="top-meta"><span className="status-pill"><span className="status-light" /> Development laboratory</span><span className="meta-divider" /><span className="top-version">V 0.1 · PREVIEW</span></div>
      </header>
      <div className="workbench">
        <main className="workspace">
          <div className="scenario-header">
            <div><div className="eyebrow">ELECTION EXPLORER <span className="eyebrow-line" /></div><h1>{election.title}</h1><p>{election.office} <span className="middle-dot">·</span> {election.year ?? "Undated"} <span className="middle-dot">·</span> Experimental scenario</p></div>
            <span className="synthetic-pill">SYNTHETIC DATA</span>
          </div>
          <section className="score-panel" aria-label="Candidate scoreboard">
            <div className="panel-caption"><span>STATEWIDE SCOREBOARD</span><span>{formatNumber(stateTotals.ballots)} total ballots · {candidates.length} candidates</span></div>
            <div className="score-grid">
              {candidates.map((candidate) => <CandidateScore key={candidate.id} candidate={candidate} votes={stateTotals.votes[candidate.id] ?? 0} baselineVotes={baselineTotals.votes[candidate.id] ?? 0} total={candidateBallots} />)}
            </div>
            <div className="score-foot"><span><i className="tiny-pulse" /> Live deterministic simulation · {scenario.actions.length} applied action(s)</span><span>All percentages are candidate-ballot shares</span></div>
          </section>
          <section className="map-panel" aria-label="County map">
            <div className="map-top">
              <div className="map-top-title"><span className="map-icon" aria-hidden="true">◈</span><span>GEOGRAPHY <strong>{geometry ? "Tennessee · real county boundaries" : "Tennessee · non-geographic 95-county atlas"}</strong></span></div>
              <div className="map-tools"><span className="map-tool-label">VIEW</span><button type="button" onClick={() => setShowResults(true)} className={showResults ? "tool-button active" : "tool-button"}>Leaders</button><button type="button" className={!showResults ? "tool-button active" : "tool-button"} onClick={() => setShowResults(false)}>Neutral</button></div>
            </div>
            <div className="map-frame">
              {painted
                ? <MapCanvas counties={painted} selectedGeoId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
                : <SchematicAtlas references={references} result={result} candidates={candidates}
                    selectedGeoId={selectedId} showResults={showResults}
                    onSelect={setSelectedId} onHover={setHoveredId} />}
              <div className="map-watermark" aria-hidden="true"><span>VOTATLAS / DEVELOPMENT</span><strong>TN</strong></div>
              {hoveredShape && <div className="map-hover-note" role="status">{hoveredShape.name} · FIPS {hoveredId}</div>}
              <div className="map-disclaimer">{geometry ? "US Census boundaries · synthetic vote data" : "Illustrative tiles only — not geographic boundaries"}</div>
            </div>
            <div className="legend-bar"><div className="legend-title">MAP KEY <span>Candidate with the most simulated votes in each county</span></div><div className="legend-items">{candidates.map((candidate) => <CandidateKey key={candidate.id} candidate={candidate} />)}<span className="candidate-key"><i style={{ background: "#476476" }} />Tie / no data</span></div></div>
          </section>
          <section className="county-explorer">
            <div className="explorer-heading"><div><span className="eyebrow">ACCESSIBLE GEOGRAPHY NAVIGATION</span><h2>Explore Tennessee counties</h2></div><span className="count-bubble">{references.length} counties in fixture</span></div>
            <label htmlFor="county-search">Find a county by name or FIPS code</label>
            <input id="county-search" type="search" placeholder="Search counties…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="county-list" aria-label="County selection list">
              {filteredCounties.map((county) => (
                <button type="button" key={county.geoId} aria-pressed={selectedId === county.geoId}
                  onClick={() => setSelectedId(county.geoId)} className={selectedId === county.geoId ? "county-chip selected" : "county-chip"}>
                  {county.name} <small>{county.geoId}</small>
                </button>
              ))}
              {filteredCounties.length === 0 && <p className="help-text">No matching counties in this synthetic fixture.</p>}
            </div>
          </section>
        </main>
        <aside className="inspector" aria-label="Scenario controls">
          <div className="inspector-head"><div><span className="eyebrow">THE WORKBENCH</span><h2>Scenario controls</h2></div><span className="inspector-symbol" aria-hidden="true">⌘</span></div>
          <div className="inspector-tabs" aria-label="Control categories">
            {(["Election", "Candidates", "Local", "Style"] as const).map((tab) =>
              <button type="button" key={tab} onClick={() => { setActiveTab(tab); setActionMessage(""); }}
                className={tab === activeTab ? "inspector-tab active" : "inspector-tab"} aria-current={tab === activeTab ? "page" : undefined}>{tab}</button>)}
            <button type="button" className="inspector-tab disabled" disabled title="No overlap-safe demographic cohort model is available yet">Demographics</button>
          </div>
          <section className="scenario-actions" aria-label="Scenario history and JSON">
            <h3>Scenario history <span className="count-bubble">{scenario.actions.length} action(s)</span></h3>
            <div className="scenario-buttons">
              <button type="button" onClick={onUndo} disabled={scenario.actions.length === 0}>Undo</button>
              <button type="button" onClick={onReset} disabled={scenario.actions.length === 0}>Reset</button>
            </div>
            <label className="scenario-editor-label" htmlFor="scenario-file">Load a saved scenario file</label>
            <input id="scenario-file" className="scenario-file" type="file" accept=".json,application/json"
              aria-label="Import scenario JSON file" onChange={async (event) => {
                const field = event.currentTarget;
                const file = field.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) {
                  setActionMessage("Scenario file is too large. Maximum file size is 1 MB.");
                  field.value = "";
                  return;
                }
                try {
                  const raw = await file.text();
                  setScenarioJson(raw);
                  setActionMessage("");
                  onImport(raw);
                } catch {
                  setActionMessage("Could not read this scenario file.");
                } finally { field.value = ""; }
              }} />
            <label className="scenario-editor-label" htmlFor="scenario-json">Scenario JSON · schema v1</label>
            <textarea id="scenario-json" className="scenario-json" rows={3} value={scenarioJson}
              onChange={(event) => setScenarioJson(event.target.value)}
              placeholder="Export an action history or paste a saved JSON scenario here…" />
            <div className="scenario-buttons">
              <button type="button" onClick={() => {
                const raw = onExport();
                setScenarioJson(raw);
                const file = new Blob([raw], { type: "application/json" });
                const url = URL.createObjectURL(file);
                const anchor = document.createElement("a");
                anchor.href = url; anchor.download = "votatlas-scenario.json";
                document.body.appendChild(anchor); anchor.click(); anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 0);
              }}>Export JSON</button>
              <button type="button" onClick={() => { setActionMessage(""); onImport(scenarioJson); }}
                disabled={!scenarioJson.trim()}>Import JSON</button>
            </div>
            {message && <p role="status" className="scenario-notice">{message}</p>}
            {error && <div role="alert" className="scenario-error">{error}</div>}
          </section>
          <div className="inspector-body">
            {activeTab === "Election" && <div className="control-section">
              <span className="eyebrow">ELECTION DEFINITION</span><h3>{election.title}</h3>
              <div className="info-grid"><span>Office <strong>{election.office}</strong></span><span>Geography <strong>95 Tennessee counties · {geometry ? "US Census boundaries" : "non-geographic tiles"}</strong></span><span>Data status <strong>{election.dataStatus}</strong></span><span>Vintage <strong>{election.geographyVintage}</strong></span></div>
              <p className="info-note">This is a development fixture. Historical election selection will activate when E3's verified datasets are integrated.</p>
            </div>}
            {activeTab === "Candidates" && <div className="control-section">
              <span className="eyebrow">CANDIDATE-NEUTRAL ADJUSTMENTS</span><h3>Set candidate support</h3>
              <div className="candidate-roster">{candidates.map((candidate) => <div key={candidate.id} className="roster-row"><CandidateKey candidate={candidate} /><small>{candidate.partyLabel ?? "Unaffiliated"}</small></div>)}</div>
              <label htmlFor="target-candidate">Target candidate</label><select id="target-candidate" value={targetCandidateId} onChange={(e) => setTargetCandidateId(e.target.value)}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="target-share">Target candidate-ballot share (%)</label><input id="target-share" type="number" min="0" max="100" step="0.1" value={targetShare} onChange={(e) => setTargetShare(e.target.value)} />
              <p className="help-text">Explicit redistribution: proportional across all other candidates. The deterministic engine checks feasibility before applying.</p>
              <button type="button" className="action-button" onClick={submitShare}>Apply SET_SHARE <span>↗</span></button>
              <p className="info-note">Candidate names and ballot order come from the election definition. Roster editing requires a future contract update.</p>
            </div>}
            {activeTab === "Local" && <div className="control-section">
              <span className="eyebrow">LOCAL ELECTION ADJUSTMENTS</span><h3>Shape a scenario</h3>
              <label htmlFor="adjustment-scope">Apply adjustment to</label><select id="adjustment-scope" value={scopeChoice} onChange={(e) => setScopeChoice(e.target.value as "county" | "state")}><option value="county">Selected county{selectedShape ? " · " + selectedShape.name : " (choose one)"}</option><option value="state">Entire Tennessee fixture</option></select>
              <div className="form-rule" /><h4>Transfer candidate support</h4>
              <label htmlFor="transfer-from">From candidate</label><select id="transfer-from" value={fromCandidateId} onChange={(e) => setFromCandidateId(e.target.value)}>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="transfer-to">To candidate</label><select id="transfer-to" value={toCandidateId} onChange={(e) => setToCandidateId(e.target.value)}>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="transfer-points">Transfer (percentage points of candidate ballots)</label><div className="input-suffix"><input id="transfer-points" type="number" min="0.1" max="100" step="0.1" value={points} onChange={(e) => setPoints(e.target.value)} /><span>PP</span></div>
              <button type="button" className="action-button" onClick={submitTransfer}>Apply TRANSFER_PP <span>↗</span></button>
              <div className="form-rule" /><h4>Change turnout</h4>
              <label htmlFor="turnout-factor">Ballot multiplier (modeled)</label><div className="input-suffix"><input id="turnout-factor" type="number" min="0.01" max="10" step="0.01" value={turnoutFactor} onChange={(e) => setTurnoutFactor(e.target.value)} /><span>×</span></div>
              <button type="button" className="outline-button" onClick={submitTurnout}>Apply TURNOUT_SCALE <span>↗</span></button>
              <p className="help-text">Turnout allocation: proportional across candidates. The engine validates feasibility and rounds votes.</p>
            </div>}
            {activeTab === "Style" && <div className="control-section">
              <span className="eyebrow">MAP PRESENTATION</span><h3>Display settings</h3>
              <label className="checkline"><input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} /><span>Color counties by current leader</span></label>
              <p className="info-note">This changes only the map presentation. It never changes vote counts or adjustment history.</p>
            </div>}
            <div className="disabled-note"><span aria-hidden="true">◇</span><div><strong>Demographics locked</strong><p>Requires overlap-safe cohort data and a verified demographic engine. No fabricated controls.</p></div></div>
            {actionMessage && <div className="action-feedback" role="status">{actionMessage}</div>}
            <div className="queue-state"><span>ENGINE ACTION HISTORY</span><strong>{scenario.actions.length} applied</strong><p>Each action is validated and replayed in order by the deterministic simulator.</p></div>
            <UnitDetails unit={selectedUnit} baselineUnit={baselineUnit} countyName={selectedShape?.name ?? "Unknown county"} candidates={candidates} />
          </div>
          <div className="inspector-footer"><span>● SYNTHETIC SANDBOX</span><span>Simulation engine connected</span></div>
        </aside>
      </div>
      <footer className="site-footer"><span>VOTATLAS — EVERY MAP. EVERY POSSIBILITY.</span><span>Fictional candidates · invented votes · non-geographic tiles unless boundaries are sourced · not an election forecast</span></footer>
    </div>
  );
}
