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
