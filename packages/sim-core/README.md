# @votatlas/sim-core

Deterministic, pure TypeScript v0.1 election sandbox; source election and county units are never changed. Implements the conductor-owned `@votatlas/contracts` API.

```ts
import { simulateElection, appendAction, undoLastAction, serializeScenario, parseScenario } from "@votatlas/sim-core";
const result = simulateElection(election, countyBaseline, scenario);
```

## Mathematical contract

- **Atomic rows:** one five-digit county GEOID per row; FIPS state prefix must equal its two-digit `stateId`. Units are sorted by GEOID. Candidate vote keys match the election registry exactly. Votes and aggregates are safe nonnegative integers. Eligible voters, when supplied, cap ballots. Unknown counties/states/candidates, duplicates, malformed imports, and district/precinct scopes fail with typed `SimulationError.code`.
- **TRANSFER_PP:** `points` is percentage points of **all candidate votes within the selected scope** (not a fraction of the donor's votes, not total ballots including `otherBallots`). Round the aggregate transfer count to nearest integer (half up). Reject if source support insufficient. Allocate removals to counties by donor support with largest remainder; transfer them to the destination *within the same county*. This preserves each county's ballots and all other candidates.
- **SET_SHARE:** `targetPercent` is the candidate's desired **absolute share of candidate ballots in the scope**. Round the desired integer to nearest (half up). `proportional-other` chooses every other candidate; `explicit-donors` chooses only the named candidate IDs, irrespective of party. When target rises, remove weighted votes from those candidates across selected county/candidate cells and add to target in each donating county. When target falls, distribute target's lost ballots to those same named candidates within each county, weighted by their current local support (equal distribution when all have zero). Reject impossible increases; every county's ballot count remains fixed.
- **TURNOUT_SCALE:** multiply **all ballots (candidate votes plus `otherBallots`) in each selected county** by `factor`. Round each new county total half up; split the result proportionally across all candidate and other-ballot categories by largest remainder. A zero-ballot county stays at zero even with `factor > 0`; an unknown eligible-voter limit (`null`) is not guessed. Fail rather than exceed a known eligible-voter bound. Turnout is applied in action-log order.
- **Rounding:** convert the decimal representation of finite JavaScript inputs into a BigInt rational for reliable products, with half-up integer rounding. Allocate via Hamilton largest remainder; ties go to ascending county GEOID then ascending candidate ID. In turnout allocation `otherBallots` comes after the sorted candidate IDs. Never round the states/nation independently: aggregate actual final county votes. An integer overflow is a typed error, not a silently imprecise result.
- **Winners:** a unique highest positive candidate vote count wins. All-zero candidate votes or an exact tie returns `winnerCandidateId: null`; `tie` is true only for a positive top-vote tie. No election-specific elector rules are invented.
- **Scenario:** `schemaVersion: 1`; action order is meaningful. `appendAction`, `undoLastAction`, `serializeScenario`, and `parseScenario` generate new objects; replay always starts from the original baseline and never mutates caller inputs. County ID sets and explicit redistribution IDs are sorted canonically during normalization. Errors are raised, never represented as fallback election results.

## Commands

Run from monorepo root after installing workspace dependencies (`pnpm install`):

```bash
pnpm --filter @votatlas/sim-core typecheck
pnpm --filter @votatlas/sim-core test
```

Synthetic test fixtures only. No third-party election data or borrowed algorithms.

## Round Two — safe hypothetical candidate registry

```ts
import {
  addCandidate, renameCandidate, removeZeroVoteCandidate, simulateElection,
  appendAction
} from "@votatlas/sim-core";

const extended = addCandidate(election, baselineUnits, {
  id: "fictional-fourth", name: "Fictional Fourth", color: "#B14EF0"
}, scenario); // Optional fourth argument is strongly recommended for existing action history.

const nextScenario = appendAction(extended.scenario ?? scenario, {
  id: "fourth-share-1", type: "SET_SHARE", scope: { kind: "national" },
  candidateId: "fictional-fourth", targetPercent: 12,
  redistribution: { kind: "proportional-other" }
});
const updated = simulateElection(extended.election, extended.baseUnits, nextScenario);
```

- `addCandidate(election, baseUnits, candidate, scenario?)` returns new `{ election, baseUnits, scenario? }` objects. Original candidate rows and baseline vote counts are cloned exactly; the new candidate starts with **0 votes in every county**, receives a default ballot order of highest+1, and participates in ordinary action math only when subsequently adjusted. New IDs must not shadow JavaScript infrastructure keys; previous historical IDs (including unusual IDs) remain legal for replay. Names, optional party labels, order, and hexadecimal colors are validated. Existing baseline rows are validated by the engine before extension.
- **Important replay safeguard:** pass the existing `scenario` as the fourth argument when adding a candidate mid-session and use `extended.scenario` thereafter. Previously queued `SET_SHARE` actions using `proportional-other` are frozen into explicit donor sets from the *old* registry, so adding a new zero-vote candidate cannot retroactively change older zero-support distribution. New `SET_SHARE` actions can include the newly added candidate normally. Replays begin from the extended zero-vote baseline; adding a candidate is not encoded as a v1 `Adjustment` and does not silently alter the conductor-owned scenario schema.
- `renameCandidate(election, candidateId, newName)` modifies metadata only on an independent clone; IDs and votes do not change.
- `removeZeroVoteCandidate(election, baseUnits, id)` removes a candidate only when **every** baseline county has exactly zero support for it. Removing any supported candidate fails with `CANDIDATE_HAS_VOTES`; there is no implicit vote redistribution and the last candidate cannot be removed. The canonical v1 contract has no historical-vs-user-added candidate provenance flag, so the caller must limit any removal UI to hypothetical candidates it created. A scenario still referencing a removed ID will fail validation; clear/reconcile actions explicitly before replay.
- New stable UI-facing errors: `INVALID_CANDIDATE`, `DUPLICATE_CANDIDATE`, `RESERVED_CANDIDATE_ID`, `CANDIDATE_HAS_VOTES` (in addition to existing `UNKNOWN_CANDIDATE`, `INVALID_BASE_UNIT`, `INVALID_ACTION`, and `INTEGER_OVERFLOW`).

Native Vitest tests exercise 2/3/5/10 candidate registries, chained 3→4→5 and 5→10 extensions, zero-support backfills, history preservation with a previously zero-support donor, deterministic 95-county replay, 220 successive mixed actions, order sensitivity, exact reset, integer conservation, and strict error validation. Candidate additions never change the provenance `dataStatus` of the underlying observed baseline; presentations must visibly label hypothetical additions as scenario modeling.

## Round Three — portable ScenarioProject v2 and trusted restore

Version **1** is unchanged: `serializeScenario` / `parseScenario` contain only ordered actions and the election ID. v1 imports against a trusted source fixture still work via `restoreScenarioProject`, but **cannot restore a newly created candidate or verify a source dataset revision**. Use v2 for exports from custom-candidate sessions.

```ts
import {
  addCandidate, appendAction, createScenarioProject,
  serializeScenarioProject, parseScenarioProject, restoreScenarioProject,
  removeZeroVoteCandidate
} from "@votatlas/sim-core";

// Preserve the authoritative source fixture separately from the working model.
const sourceElection = fixture.election;
const sourceBaseUnits = fixture.units;
let { election, baseUnits, scenario } = {
  election: sourceElection, baseUnits: sourceBaseUnits,
  scenario: { schemaVersion: 1 as const, electionId: sourceElection.id, actions: [] }
};

// Always pass ACTIVE history to addCandidate, so earlier proportional donor sets
// are frozen before a new zero-vote candidate could affect earlier operations.
const next = addCandidate(election, baseUnits, {
  id: "custom-4", name: "Fictional fourth", color: "#AABBCC"
}, scenario);
election = next.election;
baseUnits = next.baseUnits;
scenario = next.scenario!;

// Later, export all necessary metadata and actions, not untrusted ballot rows.
const project = createScenarioProject(
  sourceElection, sourceBaseUnits, election, baseUnits, scenario
);
const portableJson = serializeScenarioProject(project);

// In a new session, re-load the SAME trusted source dataset before importing.
const restored = restoreScenarioProject(portableJson, sourceElection, sourceBaseUnits);
election = restored.election;
baseUnits = restored.baseUnits;
scenario = restored.scenario;
const result = restored.result;

// v1/v2 detection for a file chooser:
const parsed = parseScenarioProject(portableJson); // Scenario (v1) | ScenarioProjectV2 (v2)

// History-aware removal REQUIRES the fourth argument, even for empty history.
// It preserves scenario and rejects nonzero current votes or references.
const removed = removeZeroVoteCandidate(election, baseUnits, "custom-4", scenario);
```

**V2 project shape:** `{ schemaVersion: 2, format: "votatlas-scenario-project", source: { electionId, geographyVintage, dataStatus, digest }, registry: { additions, overrides, candidateOrder }, scenario }`. `digest` is a browser/Node-independent SHA-256 over the *trusted* election definition (including its source candidate metadata and provenance) and every source county/ballot category in canonical sorted order. No source vote rows are embedded. Added fictional candidates include ID/name/color/ballot order/optional party label, and always receive exactly zero source votes. Metadata overrides may edit labels, colors and party labels but never source candidate IDs or ballot order. `candidateOrder` preserves UI registry display order. `scenario` retains full ordered v1 adjustments, including frozen explicit donor lists established at candidate-addition time.

**Important safety rule:** the import caller supplies canonical `sourceElection` and `sourceBaseUnits`, not a user-edited baseline. The importer verifies the election identity, vintage, status, SHA-256 digest, candidate definitions, and full action replay *before* returning any state. A fixture revision must be treated as a different dataset even when its election ID has not changed; no silent rebase or conversion is performed. Export rejects working baselines whose historical ballots were modified. Maximum JSON payload is 1 MiB, with a 2,500-action cap. Newly created IDs use restricted ASCII characters and disallow JS-reserved names. All errors use stable `SimulationError.code` values (`SOURCE_MISMATCH`, `INVALID_PROJECT`, `UNSUPPORTED_PROJECT_VERSION`, `PROJECT_TOO_LARGE`, plus existing candidate/action codes).

**Removal is deliberately more strict than Round Two:** `removeZeroVoteCandidate(election, baseUnits, id, scenario)` now requires the full active scenario and may return `.scenario`. It refuses nonzero baseline votes, nonzero final votes, direct action references, and `proportional-other` actions that could change when a candidate disappears. It replays before and after removal and proves county ballot preservation. This is a breaking change for legacy 3-argument calls: an omitted scenario now throws `INVALID_SCENARIO`. The UI must also restrict removal to its own hypothetical candidates; the source fixture has no intrinsic "fictional added" flag in v1 contracts. A source candidate cannot be omitted from a v2 project.

**Provenance boundary:** a project digest is an identity check against an application-trusted fixture, not a signature of authenticity. It does not assert official election results or allow importing arbitrary voter records. No third-party proprietary election data or algorithm is included.

Native commands (CI uses frozen pnpm lockfile):

```bash
pnpm install --frozen-lockfile
pnpm --filter @votatlas/sim-core typecheck
pnpm --filter @votatlas/sim-core test
pnpm -r --if-present typecheck
pnpm -r --if-present test
pnpm -r --if-present build
```

## Round Four — experimental synthetic cohort mathematics (NOT observed demographic data)

`simulateCohortPartition(election, trustedCountyBaseline, partition, orderedActions)` is a **separate pure opt-in layer**. It does not change `simulateElection`, the immutable v1 `Adjustment`/`Scenario` format, or the source-fingerprinted v2 `ScenarioProject` codec. **Cohort actions are not persisted by v1 or v2 exports.** Any future UI slider/editor must explicitly own its experimental cohort state and show the *synthetic modeled* label. Do not use the output as an official demographic voting observation or forecast.

```ts
import { simulateCohortPartition } from "@votatlas/sim-core";
import type { SyntheticCohortPartition, CohortAction } from "@votatlas/sim-core";

const partition: SyntheticCohortPartition = {
  schemaVersion: 1, dataStatus: "synthetic", partitionId: "fictional-split-v1",
  universe: "modeled-ballots", kind: "single", dimensionIds: ["fictional-age"],
  cohorts: [
    { id: "group-a", label: "Fictional A", dimensions: { "fictional-age": "a" } },
    { id: "group-b", label: "Fictional B", dimensions: { "fictional-age": "b" } }
  ],
  counties: [
    // A complete cell for every cohort in EVERY county in the trusted fixture.
    // Each cell: { cohortId, eligibleVoters, votes: { [candidateId]: integer }, otherBallots }
  ]
};
const edits: CohortAction[] = [{
  type: "COHORT_TRANSFER_PP", id: "example", scope: { kind: "county", countyIds: ["47037"] },
  cohortIds: ["group-a"], fromCandidateId: "aster", toCandidateId: "cedar", points: 3
}];
const modeled = simulateCohortPartition(election, originalBaseline, partition, edits);
// modeled.baseUnits: candidate-neutral county rows suitable for the original simulator
// modeled.result: original simulator's county/state/nation aggregates
// modeled.cells / modeled.deltas: sorted per-county-per-cohort audit counts
```

Rules and guarantees:

- Exactly **one mutually exclusive partition** of the modeled ballot universe is supplied per evaluation. One single-dimension marginal is accepted; intersections of 2+ dimensions require `kind: "joint"`, `jointCountsSource: "explicit-synthetic-cross-tabulation"`, complete dimension tuples, and individually provided joint cell counts. Independently supplied age/income/race marginal datasets are **not** composited or multiplied into overlapping populations. The model cannot externally certify a caller's declared synthetic joint cells; it verifies disjoint unique tuple identities and complete, exact numeric reconciliation.
- Every cohort must be present once in every known county, including zero-vote cells. Each cell's candidate votes and explicit `otherBallots` sum exactly to the original **trusted** county baseline, including `eligibleVoters` when supplied. Missing/extra counties/candidates, duplicate IDs, incomplete joint tuples, inconsistent counts and unsafe numeric inputs fail before actions run. Existing input objects are never mutated.
- `COHORT_TRANSFER_PP` moves integer support from a **named donor candidate** to another candidate inside selected disjoint cohort cells. `points` means percentage points of **candidate ballots of selected cohorts** in the scope, *excluding* `otherBallots`; donor capacity is checked before any edits. Cell ballots, other ballots, and unselected cells remain unchanged.
- `COHORT_TURNOUT_SCALE` multiplies **total modeled cell ballots** (candidate votes plus explicit `otherBallots`), half-up rounds to whole votes, then deterministically allocates categories by Hamilton largest remainder (candidate-ID order, other ballots last). A zero-turnout cohort remains zero for all positive factors. Cohort and county eligibility ceilings are enforced; turnout alone is allowed to change total ballots.
- Scope: national, state, and county. District/precinct are expressly unsupported until a disjoint atomic crosswalk is available. Identical inputs and action order produce byte-identical results; cells are sorted by county GEOID and cohort ID, candidates by ID; ties use that same stable ordering. State/nation totals are *never* independently rounded, but computed by the existing simulator from final county rows.
- Output is always labeled `dataStatus: "synthetic"`, with `universe: "modeled-ballots"` and `transferDenominator: "selected-cohort-candidate-ballots"`. The current implementation rejects elections not marked `synthetic`, preventing accidental presentation of fabricated demographic breakdowns as observed historic voter preferences.
- Actions are applied in input order, without canonicalizing non-commutative operations. For undo/reset discard actions and replay from the unchanged baseline. Long seeded action histories, four candidate counts, impossible transfers, zero cells, overlaps, permutation neutrality, voter universe consistency and 95-county identity are covered in Vitest.

## Round Five — canonical v3 cohort scenario projects (experimental, synthetic only)

**One canonical codec:** The existing `serializeScenarioProject`, `parseScenarioProject`,
`restoreScenarioProject` now accept v3 projects **without changing their v1/v2 behavior**.
There is no alternate browser codec. `createScenarioProjectV3` creates the new version;
`createScenarioProject` still exports v2. The existing `parseScenario`/
`serializeScenario` functions remain v1-only.

```ts
import {
  createScenarioProjectV3, createSyntheticDemoPartition, createSyntheticDemoModel,
  restoreScenarioProject, serializeScenarioProject, simulateElection
} from "@votatlas/sim-core";

// sourceElection/sourceUnits: immutable ORIGINAL trusted E3 fixture, before edits.
// workingElection/workingUnits: possible zero-vote custom candidate registry extension.
// scenario: existing ordered v1 ordinary actions (including frozen historical donors).
const ordinary = simulateElection(workingElection, workingUnits, scenario);
const seed = "my-reproducible-fictional-seed";
const partition = createSyntheticDemoPartition(workingElection, ordinary.units, seed);
const model = createSyntheticDemoModel(seed);
const cohortActions = [
  { type: "COHORT_TRANSFER_PP" as const, id: "demo-1",
    scope: { kind: "county" as const, countyIds: ["47037"] },
    cohortIds: ["fictional-age-18-34"],
    fromCandidateId: "aster", toCandidateId: "cedar", points: 2 }
];
const v3 = createScenarioProjectV3(
  sourceElection, sourceUnits, workingElection, workingUnits,
  scenario, partition, cohortActions, model
);
const fileContents = serializeScenarioProject(v3);
const imported = restoreScenarioProject(fileContents, sourceElection, sourceUnits);
if ("cohortResult" in imported) {
  // imported.result is the FINAL county/state/nation result after BOTH layers.
  // imported.intermediate is after classic actions, before cohort actions.
  // imported.cohortPartition, cohortActions, model are available for the UI.
}
```

**Exact ordering:** original trusted source → v2 candidate registry additions/metadata
→ **all ordinary v1 actions in order** → verify the synthetic cohort partition
reconciles **exactly** to the resulting atomic county votes and eligible universe
→ **all cohort actions in order** → county/state/nation aggregation. V3 stores the
canonical v2 `source`, `registry`, `scenario` sections unchanged and adds:

```ts
{
  schemaVersion: 3,
  format: "votatlas-scenario-project",
  source: { electionId, geographyVintage, dataStatus: "synthetic", digest },
  registry: { additions, overrides, candidateOrder },
  scenario: { schemaVersion: 1, electionId, actions: ordinaryActions },
  cohort: {
    model: { kind: "synthetic", modelId, modelVersion, seed, description },
    partition: { schemaVersion: 1, dataStatus: "synthetic", partitionId,
      kind, dimensionIds, universe: "modeled-ballots", cohorts, counties },
    actions: orderedCohortActions,
    boundTo: "sha256:<digest of source, roster, ordinary actions and their result>"
  }
}
```

**No silent drift:** the `boundTo` digest includes the entire canonical v2 source,
registry, **ordered classic history**, and its computed intermediate baseline.
Changing a classic action, candidate metadata or trusted source causes a typed
`SOURCE_MISMATCH`, **even if an added action produces no numeric change**. Rebuild
an edited partition explicitly from the new post-classic result and recreate v3;
do not keep stale modeled group counts. Undo of a cohort action is pure: remove
its last entry and recreate the project. If ordinary history is undone, rebuild
its synthetic partition explicitly. Never add cohort actions to canonical v1
`scenario.actions` or use v2 exports for active demographic changes.

**Synthetic demonstration:** `createSyntheticDemoPartition()` invents three
mutually exclusive age-*like* bins (all visibly labeled `FICTIONAL`); a stable
SHA-256-derived seeded weight allocation divides each candidate vote category,
`otherBallots`, and any known eligible-voter remainder. Counts reconcile exactly
to the provided post-classic county rows. It **does not measure or infer** actual
voters' age or political preferences. The default seed is
`votatlas-demo-2026-01` with model version `1`. For custom seeds, pass the
matching `createSyntheticDemoModel(seed)` provenance to project creation;
the saved model seed is checked against the partition ID on import.

**Trust and validation:** Projects do not embed or replace the source election
baseline. Import requires caller-supplied authoritative source and verifies its
SHA-256 source fingerprint, source ID, geography vintage, data status, candidate
registry, disjoint dimensions and all county/cohort sums. Malformed numbers,
unknown/future versions, duplicate IDs, unknown counties, overlaps, impossible
donor/turnout demands, unsafe keys and excessive payloads fail as typed errors.
Synthetic-only cohort support never rebrands estimates as observations. A
`national` scope means **the loaded election's counties only**, not all US states.
District and precinct modeling remains unavailable without valid crosswalks.

**Compatibility:** v1 action-only JSON and v2 portable candidate-registry JSON
continue to restore unchanged. V3 exposes `RestoredScenarioProjectV3` with
`result` (final modeled), `intermediate` (post-classic), `cohortResult`,
`cohortPartition`, `cohortActions` and `model`. Max JSON size is 1 MiB, preserving
the existing shared cap. Integration with E1's geographic UI is a separate PR.
