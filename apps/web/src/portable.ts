import type { BaseUnitResult, ElectionDefinition } from "@votatlas/contracts";
import { createScenarioProject, restoreScenarioProject, serializeScenarioProject } from "@votatlas/sim-core";
import type { RegistrySandboxSession } from "./sandbox";
import { hydrateRegistrySandbox } from "./sandbox";

/**
 * The single canonical portable project format is owned by sim-core.
 * A trusted source fixture is required for export and restoration; raw JSON
 * never supplies replacement baseline votes. The engine validates size,
 * source fingerprints, candidate changes and replay on both paths.
 */
export function exportPortableProject(
  session: RegistrySandboxSession, sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
): string {
  return serializeScenarioProject(createScenarioProject(
    sourceElection, sourceUnits, session.election, session.baseUnits, session.scenario
  ));
}

export function importPortableProject(
  raw: string, sourceElection: ElectionDefinition, sourceUnits: readonly BaseUnitResult[],
): RegistrySandboxSession {
  const restored = restoreScenarioProject(raw, sourceElection, sourceUnits);
  return hydrateRegistrySandbox(restored.election, restored.baseUnits, restored.scenario);
}
