import { useState } from "react";
import type { Adjustment } from "@votatlas/contracts";
import * as data from "@votatlas/data";
import type { CandidateAddition, CohortAction } from "@votatlas/sim-core";
import { SimulationError } from "@votatlas/sim-core";
import type { CountyShapes } from "@votatlas/map";
import { Dashboard } from "./Dashboard";
import {
  addRegistryCandidate, applyRegistryAction, initializeRegistrySandbox,
  renameRegistryCandidate, removeRegistryCandidate, undoRegistryAction,
  importLegacyRegistryScenario,
} from "./sandbox";
import type { RegistrySandboxSession } from "./sandbox";
import type { AcsDimension } from "./acs-source";
import { readTennesseeAcs } from "./acs-source";
import { exportPortableProject, importPortableProject } from "./portable";
import { beginSyntheticModel, beginCompositionModel, compositionFitReady, appendModelAction, canonicalV3Ready, exportProjectWithModel,
  importCanonicalProject, modelGeneratorReady, resetModelActions, undoModelAction } from "./model-lab";
import type { SyntheticModelSession } from "./model-lab";

const fixture = data.getTennesseeSyntheticFixture();
const references = data.getTennesseeCountyReferences();
const geometry: CountyShapes = data.getTennesseeRealCountyGeoJSON();
const errorMessage = (cause: unknown) => cause instanceof SimulationError
  ? `${cause.code}: ${cause.message}` : cause instanceof Error ? cause.message : "Could not update the sandbox.";

export default function App() {
  const [session, setSession] = useState<RegistrySandboxSession>(
    () => initializeRegistrySandbox(fixture.election, fixture.units)
  );
  const [model, setModel] = useState<SyntheticModelSession | null>(null);
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

  function requireOrdinaryEditing(): boolean {
    if (!model) return true;
    setError("Exit or reset the synthetic Model Lab before editing the candidate registry or ordinary scenario. This protects the exact cohort partition baseline.");
    return false;
  }
  function apply(action: Adjustment) {
    if (!requireOrdinaryEditing()) return;
    commit(() => applyRegistryAction(session, action),
      `Applied ${action.type}. County and statewide results recalculated.`);
  }
  function undo() {
    if (model) {
      if (model.actions.length) undoModel();
      return;
    }
    if (session.scenario.actions.length === 0) return;
    commit(() => undoRegistryAction(session), "Undid the last action; registry preserved.");
  }
  function reset() {
    setModel(null);
    commit(() => initializeRegistrySandbox(fixture.election, fixture.units),
      "Reset to the exact source registry and baseline across all 95 counties.");
  }
  function addCandidate(addition: CandidateAddition): boolean {
    if (!requireOrdinaryEditing()) return false;
    return commit(() => addRegistryCandidate(session, addition),
      `Added hypothetical candidate ${addition.name} with zero baseline votes.`);
  }
  function renameCandidate(id: string, name: string): boolean {
    if (!requireOrdinaryEditing()) return false;
    return commit(() => renameRegistryCandidate(session, id, name),
      `Renamed candidate ${id}; original votes are unchanged.`);
  }
  function removeCandidate(id: string): boolean {
    if (!requireOrdinaryEditing()) return false;
    return commit(() => removeRegistryCandidate(session, id, fixture.election),
      `Removed unused hypothetical candidate ${id} without changing votes.`);
  }
  function load(raw: string): boolean {
    if (model && !canonicalV3Ready) {
      setError("Model import is disabled until canonical v3 persistence is integrated. Exit the model before importing an ordinary project.");
      return false;
    }
    try {
      if (canonicalV3Ready) {
        const restored = importCanonicalProject(raw, fixture.election, fixture.units);
        setSession(restored.ordinary);
        setModel(restored.model);
      } else {
        const restored = importPortableProject(raw, fixture.election, fixture.units);
        setSession(restored);
        setModel(null);
      }
      setError("");
      setMessage("Imported and validated the saved registry and scenario; live results restored.");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      setMessage("");
      return false;
    }
  }
  function exportProject(): string {
    try {
      const json = model
        ? exportProjectWithModel(session, model, fixture.election, fixture.units)
        : exportPortableProject(session, fixture.election, fixture.units);
      setError("");
      return json;
    } catch (cause) {
      setError(errorMessage(cause));
      return "";
    }
  }

  function beginModel(seed: string): boolean {
    try {
      const next = beginSyntheticModel(session, seed);
      setModel(next);
      setError("");
      setMessage("Started one explicitly fictional cohort partition, validated against all pre-model county ballots.");
      return true;
    } catch (cause) { setError(errorMessage(cause)); setMessage(""); return false; }
  }
  function beginAcs(dimension:AcsDimension,weights:Record<string,number>):boolean {
    if (model) { setError("Exit the current disjoint model before starting another population dimension."); return false; }
    try {
      const source=readTennesseeAcs(dimension);
      if(source.status!=="available")throw new Error(source.reason);
      const next=beginCompositionModel(session,source,weights);
      setModel(next);
      setError("");
      setMessage("Started a source-labeled ACS population model. Candidate support and turnout remain hypothetical.");
      return true;
    } catch(cause){setError(errorMessage(cause));setMessage("");return false;}
  }
  function modelAction(action: CohortAction): boolean {
    if (!model) { setError("Start the synthetic model before applying a cohort action."); return false; }
    try {
      const next = appendModelAction(session, model, action);
      setModel(next);
      setError("");
      setMessage("Applied " + action.type + " through the synthetic cohort engine.");
      return true;
    } catch (cause) { setError(errorMessage(cause)); setMessage(""); return false; }
  }
  function undoModel() {
    if (!model || !model.actions.length) return;
    try { setModel(undoModelAction(session, model)); setError(""); setMessage("Undid the last cohort model action."); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  function resetModel() {
    if (!model) return;
    try { setModel(resetModelActions(session, model)); setError(""); setMessage("Reset synthetic cohort actions; ordinary election history was preserved."); }
    catch (cause) { setError(errorMessage(cause)); }
  }
  function exitModel() {
    setModel(null);
    setError("");
    setMessage("Exited synthetic model; restored the existing ordinary election scenario.");
  }

  return <Dashboard election={session.election} trustedSource={fixture.election}
    result={model?.output.result ?? session.result} baseline={session.baseline}
    model={model} modelGeneratorReady={modelGeneratorReady} canonicalV3Ready={canonicalV3Ready}
    compositionFitReady={compositionFitReady} onBeginAcs={beginAcs}
    onBeginModel={beginModel} onModelAction={modelAction} onUndoModel={undoModel}
    onResetModel={resetModel} onExitModel={exitModel}
    references={references} geometry={geometry} scenario={session.scenario}
    onAdjustment={apply} onUndo={undo} onReset={reset}
    onAddCandidate={addCandidate} onRenameCandidate={renameCandidate} onRemoveCandidate={removeCandidate}
    onExport={exportProject} onImport={load} error={error} message={message} />;
}
