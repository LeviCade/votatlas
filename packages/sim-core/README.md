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
