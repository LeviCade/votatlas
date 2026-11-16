import { useState } from "react";
import type { Adjustment } from "@votatlas/contracts";
import { Dashboard } from "./Dashboard";
import { demoCounties, demoElection, demoResult } from "./fixtures/synthetic";

export default function App() {
  const [queuedActions, setQueuedActions] = useState<Adjustment[]>([]);
  // This preview intentionally does not compute a result. The E2 simulation
  // engine will receive these ordered, contract-shaped actions at integration.
  return (
    <Dashboard
      election={demoElection}
      result={demoResult}
      counties={demoCounties}
      queuedCount={queuedActions.length}
      onAdjustment={(action) => setQueuedActions((previous) => [...previous, action])}
    />
  );
}
