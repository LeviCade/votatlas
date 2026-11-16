import { useState } from "react";
import type { Candidate, ElectionDefinition } from "@votatlas/contracts";
import type { CandidateAddition } from "@votatlas/sim-core";
import { isHypotheticalCandidate } from "./sandbox";

export interface CandidateEditorProps {
  election: ElectionDefinition;
  trustedSource: ElectionDefinition;
  onAdd: (addition: CandidateAddition) => boolean;
  onRename: (candidateId: string, name: string) => boolean;
  onRemove: (candidateId: string) => boolean;
}

function CandidateRow({ candidate, isHypothetical, onRename, onRemove }: {
  candidate: Candidate;
  isHypothetical: boolean;
  onRename: CandidateEditorProps["onRename"];
  onRemove: CandidateEditorProps["onRemove"];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(candidate.name);
  const rename = () => {
    if (onRename(candidate.id, name.trim())) setEditing(false);
  };
  return (
    <div className="registry-row" data-testid="candidate-registry-row">
      <span className="registry-color" aria-hidden="true" style={{ backgroundColor: candidate.color }} />
      <div className="registry-description">
        {editing
          ? <form className="registry-rename" onSubmit={(event) => { event.preventDefault(); rename(); }}>
              <label htmlFor={`rename-${candidate.id}`}>Rename {candidate.name}</label>
              <input id={`rename-${candidate.id}`} value={name} maxLength={128}
                onChange={(event) => setName(event.target.value)} required />
              <div className="registry-buttons">
                <button type="submit">Save name</button>
                <button type="button" onClick={() => { setName(candidate.name); setEditing(false); }}>Cancel</button>
              </div>
            </form>
          : <>
              <strong>{candidate.name}</strong>
              <small>{candidate.id} · {candidate.partyLabel ?? "Unaffiliated"}</small>
              <small className="registry-source">{isHypothetical ? "Hypothetical addition" : "Original source candidate · protected"}</small>
            </>}
      </div>
      {!editing && <div className="registry-buttons">
        <button type="button" aria-label={`Rename ${candidate.name}`}
          onClick={() => { setName(candidate.name); setEditing(true); }}>Rename</button>
        {isHypothetical && <button type="button" className="registry-remove"
          aria-label={`Remove ${candidate.name}`} onClick={() => onRemove(candidate.id)}>Remove</button>}
      </div>}
    </div>
  );
}

/** A UI for metadata only: vote counts and registry edits remain delegated to sim-core. */
export function CandidateEditor({ election, trustedSource, onAdd, onRename, onRemove }: CandidateEditorProps) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [partyLabel, setPartyLabel] = useState("");
  const [color, setColor] = useState("#DA73B5");
  const candidates = [...election.candidates].sort((a, b) => a.ballotOrder - b.ballotOrder);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const addition: CandidateAddition = {
      id: id.trim(), name: name.trim(), color,
      ...(partyLabel.trim() ? { partyLabel: partyLabel.trim() } : {}),
    };
    if (onAdd(addition)) { setId(""); setName(""); setPartyLabel(""); }
  };
  return (
    <section className="candidate-editor" aria-label="Candidate registry editor">
      <div className="registry-heading">
        <h3>Candidate registry</h3>
        <span className="count-bubble" data-testid="registry-count">{candidates.length} candidates</span>
      </div>
      <p className="help-text">Existing candidates and votes are protected. New candidates start with zero votes in all 95 counties and may receive support through adjustments.</p>
      <div className="registry-list">
        {candidates.map(candidate =>
          <CandidateRow key={candidate.id} candidate={candidate}
            isHypothetical={isHypotheticalCandidate(candidate, trustedSource)}
            onRename={onRename} onRemove={onRemove} />)}
      </div>
      <form className="registry-add-form" onSubmit={submit}>
        <h4>Add fictional candidate</h4>
        <label htmlFor="candidate-id">Stable candidate ID</label>
        <input id="candidate-id" required maxLength={128} placeholder="example-2026" value={id}
          onChange={(event) => setId(event.target.value)} />
        <label htmlFor="candidate-name">Candidate name</label>
        <input id="candidate-name" required maxLength={128} placeholder="Fictional candidate" value={name}
          onChange={(event) => setName(event.target.value)} />
        <label htmlFor="candidate-affiliation">Affiliation (optional)</label>
        <input id="candidate-affiliation" maxLength={128} placeholder="Independent" value={partyLabel}
          onChange={(event) => setPartyLabel(event.target.value)} />
        <label htmlFor="candidate-color">Candidate map color</label>
        <div className="registry-color-picker">
          <input id="candidate-color" type="color" value={color}
            onChange={(event) => setColor(event.target.value)} />
          <output htmlFor="candidate-color">{color.toUpperCase()}</output>
        </div>
        <button className="action-button" type="submit">Add candidate <span aria-hidden="true">+</span></button>
      </form>
      <p className="info-note">A saved scenario project must include this expanded registry. A v1 action-only file cannot recreate hypothetical candidates.</p>
    </section>
  );
}
