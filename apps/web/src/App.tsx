import { useState } from "react";
import type { Adjustment } from "@votatlas/contracts";
import * as data from "@votatlas/data";
import type { CandidateAddition } from "@votatlas/sim-core";
import { SimulationError } from "@votatlas/sim-core";
import type { CountyShapes } from "@votatlas/map";
import { Dashboard } from "./Dashboard";
import {
  addRegistryCandidate, applyRegistryAction, initializeRegistrySandbox,
  renameRegistryCandidate, removeRegistryCandidate, undoRegistryAction,
  importLegacyRegistryScenario,
} from "./sandbox";
import type { RegistrySandboxSession } from "./sandbox";
import { exportPortableProject, importPortableProject } from "./portable";

const fixture = data.getTennesseeSyntheticFixture();
const references = data.getTennesseeCountyReferences();
const geometry: CountyShapes = data.getTennesseeRealCountyGeoJSON();
const errorMessage = (cause: unknown) => cause instanceof SimulationError
  ? `${cause.code}: ${cause.message}` : cause instanceof Error ? cause.message : "Could not update the sandbox.";

export default function App() {
  const [session, setSession] = useState<RegistrySandboxSession>(
    () => initializeRegistrySandbox(fixture.election, fixture.units)
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /** Never commit a partially valid election/registry/scenario/result. */
  function commit(change: () => RegistrySandboxSession, description: string): boolean {
    try {
      const next = change();
      setSession(next);
      setError("");
      setMessage(description);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      setMessage("");
      return false;
    }
  }

  function apply(action: Adjustment) {
    commit(() => applyRegistryAction(session, action),
      `Applied ${action.type}. County and statewide results recalculated.`);
  }
  function undo() {
    if (session.scenario.actions.length === 0) return;
    commit(() => undoRegistryAction(session), "Undid the last action; registry preserved.");
  }
  function reset() {
    commit(() => initializeRegistrySandbox(fixture.election, fixture.units),
      "Reset to the exact source registry and baseline across all 95 counties.");
  }
  function addCandidate(addition: CandidateAddition): boolean {
    return commit(() => addRegistryCandidate(session, addition),
      `Added hypothetical candidate ${addition.name} with zero baseline votes.`);
  }
  function renameCandidate(id: string, name: string): boolean {
    return commit(() => renameRegistryCandidate(session, id, name),
      `Renamed candidate ${id}; original votes are unchanged.`);
  }
  function removeCandidate(id: string): boolean {
    return commit(() => removeRegistryCandidate(session, id, fixture.election),
      `Removed unused hypothetical candidate ${id} without changing votes.`);
  }
  function load(raw: string): boolean {
    return commit(() => importPortableProject(raw, fixture.election, fixture.units),
      "Imported and validated the saved registry and scenario; live results restored.");
  }
  function exportProject(): string {
    try {
      const json = exportPortableProject(session, fixture.election, fixture.units);
      setError("");
      return json;
    } catch (cause) {
      setError(errorMessage(cause));
      return "";
    }
  }

  return <Dashboard election={session.election} trustedSource={fixture.election}
    result={session.result} baseline={session.baseline}
    references={references} geometry={geometry} scenario={session.scenario}
    onAdjustment={apply} onUndo={undo} onReset={reset}
    onAddCandidate={addCandidate} onRenameCandidate={renameCandidate} onRemoveCandidate={removeCandidate}
    onExport={exportProject} onImport={load} error={error} message={message} />;
}
