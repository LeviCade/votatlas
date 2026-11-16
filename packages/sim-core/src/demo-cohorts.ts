import type { BaseUnitResult, ElectionDefinition } from "@votatlas/contracts";
import type { SyntheticCohortPartition } from "./cohorts.js";
import { simulateElection, SimulationError } from "./engine.js";
import { sha256Hex } from "./sha256.js";
import type { CohortModelProvenance } from "./scenario-project.js";

/** Deliberately fictional cohort bins. These are NOT observed age-specific voting data. */
export const FICTIONAL_COHORT_MODEL_VERSION = "1";
export const DEFAULT_FICTIONAL_COHORT_SEED = "votatlas-demo-2026-01";
export const FICTIONAL_COHORT_MODEL_DESCRIPTION =
  "Entirely fictional age-like bins and invented within-county candidate preferences; not observed demographics, not Census estimates, and not historical voter behavior.";

export function createSyntheticDemoModel(seed: string = DEFAULT_FICTIONAL_COHORT_SEED): CohortModelProvenance {
  validateSeed(seed);
  return {
    kind: "synthetic", modelId: "fictional-cohort-demo", modelVersion: FICTIONAL_COHORT_MODEL_VERSION,
    seed, description: FICTIONAL_COHORT_MODEL_DESCRIPTION
  };
}

export function fictionalDemoPartitionId(seed: string): string {
  validateSeed(seed);
  return `fictional-age-demo-v1-${sha256Hex(seed).slice(0, 12)}`;
}
function validateSeed(seed: unknown): asserts seed is string {
  if (typeof seed !== "string" || !seed.trim() || seed !== seed.trim() || seed.length > 128 || /[\x00-\x1f\x7f]/.test(seed)) {
    throw new SimulationError("INVALID_PROJECT", "Fictional cohort demo seed must be a short nonempty string");
  }
}

const groups = [
  { id: "fictional-age-18-34", label: "FICTIONAL modeled age 18–34", value: "18-34" },
  { id: "fictional-age-35-54", label: "FICTIONAL modeled age 35–54", value: "35-54" },
  { id: "fictional-age-55-plus", label: "FICTIONAL modeled age 55+", value: "55-plus" }
] as const;

function distribute(total: number, seed: string, county: string, category: string): number[] {
  // Largest remainder with stable group-ID tie-breaking. Seeded weights are illustrative, not estimates.
  const weights = groups.map(group => 1 + (parseInt(sha256Hex(JSON.stringify([
    "fictional-cohort-v1", seed, county, category, group.id
  ])).slice(0, 8), 16) % 7));
  const denominator = BigInt(weights.reduce((a, b) => a + b, 0));
  const numerators = weights.map(value => BigInt(value) * BigInt(total));
  const result = numerators.map(n => Number(n / denominator));
  let remaining = total - result.reduce((a, b) => a + b, 0);
  const priority = numerators.map((n, index) => ({ index, remainder: n % denominator }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const { index } of priority) {
    if (remaining <= 0) break;
    result[index]!++;
    remaining--;
  }
  return result;
}

/**
 * Deterministic synthetic fixture from the POST-CLASSIC atomic rows.
 * Every candidate, other ballot, and known eligible voter is partitioned exactly.
 * No observed demographic measurements or behavior enter this model.
 */
export function createSyntheticDemoPartition(
  election: ElectionDefinition,
  ordinaryResultUnits: readonly BaseUnitResult[],
  seed: string = DEFAULT_FICTIONAL_COHORT_SEED
): SyntheticCohortPartition {
  validateSeed(seed);
  if (election.dataStatus !== "synthetic") {
    throw new SimulationError("INVALID_PROJECT", "Fictional demographic demo is restricted to synthetic elections");
  }
  const ordinary = simulateElection(election, ordinaryResultUnits, {
    schemaVersion: 1, electionId: election.id, actions: []
  });
  const ids = election.candidates.map(c => c.id).sort();
  return {
    schemaVersion: 1,
    dataStatus: "synthetic",
    partitionId: fictionalDemoPartitionId(seed),
    kind: "single",
    dimensionIds: ["fictionalAgeGroup"],
    universe: "modeled-ballots",
    cohorts: groups.map(g => ({
      id: g.id, label: g.label, dimensions: { fictionalAgeGroup: g.value }
    })),
    counties: ordinary.units.map(row => {
      const cells = groups.map(group => ({
        cohortId: group.id,
        eligibleVoters: row.eligibleVoters === null ? null : 0,
        votes: Object.fromEntries(ids.map(id => [id, 0])) as Record<string, number>,
        otherBallots: 0
      }));
      for (const id of ids) {
        const values = distribute(row.votes[id]!, seed, row.geoId, `candidate:${id}`);
        values.forEach((value, i) => { cells[i]!.votes[id] = value; });
      }
      const other = distribute(row.otherBallots, seed, row.geoId, "otherBallots");
      other.forEach((value, i) => { cells[i]!.otherBallots = value; });
      if (row.eligibleVoters !== null) {
        const total = ids.reduce((sum, id) => sum + row.votes[id]!, row.otherBallots);
        const slack = distribute(row.eligibleVoters - total, seed, row.geoId, "eligibleSlack");
        cells.forEach((cell, i) => {
          cell.eligibleVoters = slack[i]! + ids.reduce((sum, id) => sum + cell.votes[id]!, cell.otherBallots);
        });
      }
      return { geoId: row.geoId, cells };
    })
  };
}
