import { useMemo, useState } from "react";
import type {
  Adjustment, Candidate, ElectionDefinition, GeoScope, SimulationResult, UnitResult,
} from "@votatlas/contracts";
import { MapCanvas, paintCounties, uniqueLeader } from "@votatlas/map";
import type { CountyShapes } from "@votatlas/map";

type TabName = "Election" | "Candidates" | "Local" | "Style";
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const percentOf = (votes: number, total: number) => total > 0 ? 100 * votes / total : 0;
const actionId = () => "ui-" + (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()));

export interface DashboardProps {
  election: ElectionDefinition;
  result: SimulationResult;
  counties: CountyShapes;
  onAdjustment: (action: Adjustment) => void;
  queuedCount?: number;
}
function CandidateKey({ candidate }: { candidate: Candidate }) {
  return <span className="candidate-key"><i style={{ backgroundColor: candidate.color }} aria-hidden="true" />{candidate.name}</span>;
}
function CandidateScore({ candidate, votes, total }: { candidate: Candidate; votes: number; total: number }) {
  const share = percentOf(votes, total);
  return (
    <div className="score-item" data-testid="candidate-score">
      <div className="score-head">
        <span className="score-dot" style={{ background: candidate.color }} aria-hidden="true" />
        <span className="score-name">{candidate.name}</span>
        <span className="score-share">{share.toFixed(1)}%</span>
      </div>
      <div className="score-meta"><span>{candidate.partyLabel ?? "Unaffiliated"}</span><strong>{formatNumber(votes)} votes</strong></div>
      <div className="score-meter"><span style={{ width: share + "%", backgroundColor: candidate.color }} /></div>
    </div>
  );
}
function UnitDetails({ unit, countyName, candidates }: {
  unit: UnitResult | null; countyName: string; candidates: Candidate[];
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
          <span>{formatNumber(unit.votes[candidate.id] ?? 0)}</span>
        </div>
      ))}
      <p className="help-text">Shares use candidate ballots only. Other ballots are listed separately.</p>
    </section>
  );
}
export function Dashboard({ election, result, counties, onAdjustment, queuedCount = 0 }: DashboardProps) {
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
  const painted = useMemo(() => paintCounties(counties, result, candidates, showResults), [counties, result, election.candidates, showResults]);
  const selectedShape = counties.features.find((f) => f.properties.geoId === selectedId);
  const selectedUnit = result.units.find((unit) => unit.geoId === selectedId) ?? null;
  const hoveredShape = counties.features.find((f) => f.properties.geoId === hoveredId);
  const stateTotals = result.byState["47"] ?? result.national;
  const candidateBallots = candidates.reduce((total, c) => total + (stateTotals.votes[c.id] ?? 0), 0);
  const filteredCounties = counties.features.filter((feature) =>
    (feature.properties.name + " " + feature.properties.geoId).toLowerCase().includes(search.toLowerCase().trim()));
  const scope = (): GeoScope | null => scopeChoice === "state"
    ? { kind: "state", stateId: "47" }
    : selectedId ? { kind: "county", countyIds: [selectedId] } : null;

  function sendAdjustment(make: (resolvedScope: GeoScope) => Adjustment | null) {
    const resolvedScope = scope();
    if (!resolvedScope) { setActionMessage("Select a county first, or switch the scope to Tennessee."); return; }
    const next = make(resolvedScope);
    if (!next) return;
    onAdjustment(next);
    setActionMessage("Action queued for the simulation engine. Demo vote totals remain unchanged.");
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
              {candidates.map((candidate) => <CandidateScore key={candidate.id} candidate={candidate} votes={stateTotals.votes[candidate.id] ?? 0} total={candidateBallots} />)}
            </div>
            <div className="score-foot"><span><i className="tiny-pulse" /> Static synthetic baseline</span><span>All percentages are candidate-ballot shares</span></div>
          </section>
          <section className="map-panel" aria-label="County map">
            <div className="map-top">
              <div className="map-top-title"><span className="map-icon" aria-hidden="true">◈</span><span>GEOGRAPHY <strong>Tennessee · schematic counties</strong></span></div>
              <div className="map-tools"><span className="map-tool-label">VIEW</span><button type="button" onClick={() => setShowResults(true)} className={showResults ? "tool-button active" : "tool-button"}>Leaders</button><button type="button" className={!showResults ? "tool-button active" : "tool-button"} onClick={() => setShowResults(false)}>Neutral</button></div>
            </div>
            <div className="map-frame">
              <MapCanvas counties={painted} selectedGeoId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
              <div className="map-watermark" aria-hidden="true"><span>VOTATLAS / DEVELOPMENT</span><strong>TN</strong></div>
              {hoveredShape && <div className="map-hover-note" role="status">{hoveredShape.properties.name} County · FIPS {hoveredId}</div>}
              <div className="map-disclaimer">Illustrative tiles, not actual county boundaries</div>
            </div>
            <div className="legend-bar"><div className="legend-title">MAP KEY <span>Candidate with most votes in each sample county</span></div><div className="legend-items">{candidates.map((candidate) => <CandidateKey key={candidate.id} candidate={candidate} />)}<span className="candidate-key"><i style={{ background: "#476476" }} />Tie / no data</span></div></div>
          </section>
          <section className="county-explorer">
            <div className="explorer-heading"><div><span className="eyebrow">ACCESSIBLE GEOGRAPHY NAVIGATION</span><h2>Explore sample counties</h2></div><span className="count-bubble">{counties.features.length} counties in demo</span></div>
            <label htmlFor="county-search">Find a county by name or FIPS code</label>
            <input id="county-search" type="search" placeholder="Search counties…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="county-list" aria-label="County selection list">
              {filteredCounties.map((feature) => (
                <button type="button" key={feature.properties.geoId} aria-pressed={selectedId === feature.properties.geoId}
                  onClick={() => setSelectedId(feature.properties.geoId)} className={selectedId === feature.properties.geoId ? "county-chip selected" : "county-chip"}>
                  {feature.properties.name} <small>{feature.properties.geoId}</small>
                </button>
              ))}
              {filteredCounties.length === 0 && <p className="help-text">No matching counties in this development fixture.</p>}
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
          <div className="inspector-body">
            {activeTab === "Election" && <div className="control-section">
              <span className="eyebrow">ELECTION DEFINITION</span><h3>{election.title}</h3>
              <div className="info-grid"><span>Office <strong>{election.office}</strong></span><span>Geography <strong>Tennessee · schematic</strong></span><span>Data status <strong>{election.dataStatus}</strong></span><span>Vintage <strong>{election.geographyVintage}</strong></span></div>
              <p className="info-note">This is a development fixture. Historical election selection will activate when E3's verified datasets are integrated.</p>
            </div>}
            {activeTab === "Candidates" && <div className="control-section">
              <span className="eyebrow">CANDIDATE-NEUTRAL ADJUSTMENTS</span><h3>Set candidate support</h3>
              <div className="candidate-roster">{candidates.map((candidate) => <div key={candidate.id} className="roster-row"><CandidateKey candidate={candidate} /><small>{candidate.partyLabel ?? "Unaffiliated"}</small></div>)}</div>
              <label htmlFor="target-candidate">Target candidate</label><select id="target-candidate" value={targetCandidateId} onChange={(e) => setTargetCandidateId(e.target.value)}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="target-share">Target candidate-ballot share (%)</label><input id="target-share" type="number" min="0" max="100" step="0.1" value={targetShare} onChange={(e) => setTargetShare(e.target.value)} />
              <p className="help-text">Explicit redistribution: proportional across all other candidates. Applied by the simulation engine after integration.</p>
              <button type="button" className="action-button" onClick={submitShare}>Queue SET_SHARE action <span>↗</span></button>
              <p className="info-note">Candidate names and ballot order come from the election definition. Roster editing requires a future contract update.</p>
            </div>}
            {activeTab === "Local" && <div className="control-section">
              <span className="eyebrow">LOCAL ELECTION ADJUSTMENTS</span><h3>Shape a scenario</h3>
              <label htmlFor="adjustment-scope">Apply adjustment to</label><select id="adjustment-scope" value={scopeChoice} onChange={(e) => setScopeChoice(e.target.value as "county" | "state")}><option value="county">Selected county{selectedShape ? " · " + selectedShape.properties.name : " (choose one)"}</option><option value="state">Entire Tennessee fixture</option></select>
              <div className="form-rule" /><h4>Transfer candidate support</h4>
              <label htmlFor="transfer-from">From candidate</label><select id="transfer-from" value={fromCandidateId} onChange={(e) => setFromCandidateId(e.target.value)}>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="transfer-to">To candidate</label><select id="transfer-to" value={toCandidateId} onChange={(e) => setToCandidateId(e.target.value)}>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
              <label htmlFor="transfer-points">Transfer (percentage points of candidate ballots)</label><div className="input-suffix"><input id="transfer-points" type="number" min="0.1" max="100" step="0.1" value={points} onChange={(e) => setPoints(e.target.value)} /><span>PP</span></div>
              <button type="button" className="action-button" onClick={submitTransfer}>Queue TRANSFER_PP action <span>↗</span></button>
              <div className="form-rule" /><h4>Change turnout</h4>
              <label htmlFor="turnout-factor">Ballot multiplier (modeled)</label><div className="input-suffix"><input id="turnout-factor" type="number" min="0.01" max="10" step="0.01" value={turnoutFactor} onChange={(e) => setTurnoutFactor(e.target.value)} /><span>×</span></div>
              <button type="button" className="outline-button" onClick={submitTurnout}>Queue TURNOUT_SCALE <span>↗</span></button>
              <p className="help-text">Turnout allocation: proportional across candidates. The engine validates feasibility and rounds votes.</p>
            </div>}
            {activeTab === "Style" && <div className="control-section">
              <span className="eyebrow">MAP PRESENTATION</span><h3>Display settings</h3>
              <label className="checkline"><input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} /><span>Color counties by current leader</span></label>
              <p className="info-note">This changes only the map presentation. It never changes vote counts or adjustment history.</p>
            </div>}
            <div className="disabled-note"><span aria-hidden="true">◇</span><div><strong>Demographics locked</strong><p>Requires overlap-safe cohort data and a verified demographic engine. No fabricated controls.</p></div></div>
            {actionMessage && <div className="action-feedback" role="status">{actionMessage}</div>}
            <div className="queue-state"><span>ENGINE ACTION QUEUE</span><strong>{queuedCount} pending</strong><p>Commands are captured but not applied to the static preview until the E2 core adapter is wired.</p></div>
            <UnitDetails unit={selectedUnit} countyName={selectedShape?.properties.name ?? "Unknown county"} candidates={candidates} />
          </div>
          <div className="inspector-footer"><span>● DEVELOPMENT MODE</span><span>Simulation not connected</span></div>
        </aside>
      </div>
      <footer className="site-footer"><span>VOTATLAS — EVERY MAP. EVERY POSSIBILITY.</span><span>Fictional candidates · invented votes · schematic geography · not an election forecast</span></footer>
    </div>
  );
}
