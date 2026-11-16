import { useMemo, useState } from "react";
import type { Adjustment } from "@votatlas/contracts";
import { getTennesseeCountyReferences, getTennesseeSyntheticFixture } from "@votatlas/data";
import { SimulationError } from "@votatlas/sim-core";
import { Dashboard } from "./Dashboard";
import { applySandboxAction, exportSandboxScenario, importSandboxScenario, initializeSandbox, undoSandboxAction } from "./sandbox";

const fixture = getTennesseeSyntheticFixture();
const references = getTennesseeCountyReferences();
const errorMessage = (cause: unknown) => cause instanceof SimulationError
  ? `${cause.code}: ${cause.message}` : cause instanceof Error ? cause.message : "Could not update the sandbox.";

export default function App() {
  const baseline = useMemo(() => initializeSandbox(fixture.election, fixture.units), []);
  const [session, setSession] = useState(baseline);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function apply(action: Adjustment): void {
    try {
      const next = applySandboxAction(fixture.election, fixture.units, session, action);
      setSession(next); setError(""); setMessage(`Applied ${action.type}. County and statewide results recalculated.`);
    } catch (cause) { setError(errorMessage(cause)); setMessage(""); }
  }
  function undo(): void {
    if (!session.scenario.actions.length) return;
    try {
      setSession(undoSandboxAction(fixture.election, fixture.units, session));
      setError(""); setMessage("Undid the last action; results recalculated from the baseline.");
    } catch (cause) { setError(errorMessage(cause)); setMessage(""); }
  }
  function reset(): void {
    setSession(baseline); setError(""); setMessage("Reset to the exact synthetic baseline across all 95 counties.");
  }
  function load(raw: string): boolean {
    try {
      const next = importSandboxScenario(fixture.election, fixture.units, raw);
      setSession(next); setError(""); setMessage(`Imported ${next.scenario.actions.length} action(s) and restored the results.`);
      return true;
    } catch (cause) { setError(errorMessage(cause)); setMessage(""); return false; }
  }
  return <Dashboard election={fixture.election} result={session.result} baseline={baseline.result}
    references={references} scenario={session.scenario} onAdjustment={apply} onUndo={undo}
    onReset={reset} onExport={() => exportSandboxScenario(session)} onImport={load}
    error={error} message={message} />;
}
