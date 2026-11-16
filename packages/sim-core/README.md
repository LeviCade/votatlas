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
