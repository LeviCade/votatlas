# Mandatory Testing and Acceptance

## Numerical gates
1. Zero-change scenario must reproduce every input county candidate integer exactly.
2. Same dataset/version plus ordered action log yields byte-identical results on replay.
3. Transfers and share adjustments preserve candidate-ballot counts unless turnout is intentionally modified.
4. Reject negative inputs, NaN, Infinity, missing candidates, unknown geographic IDs and unsupported scopes.
5. All votes remain nonnegative integers; totals equal candidate votes plus explicit otherBallots.
6. State totals equal exact sum of constituent atomic-unit rows; national equals state sum.
7. Candidate permutation changes labels/order only, not mathematics.
8. Zero ballots and exact ties have no unique winner.
9. Undo/redo roundtrip and scenario JSON roundtrip reproduce identical outputs.
10. Synthetic population cohorts and joint distributions do not double-count overlapping people.
11. Geographic scope isolation: county adjustment does not alter unselected counties.
12. All rounding is deterministic and globally consistent; no phantom ballots.

## UI gates
- Real map or actionable renderer error, never indefinite loading.
- A keyboard-accessible county list exists in addition to map selection.
- Candidate names, colors, parties and totals remain consistent in map/legend/scoreboard.
- Historical results and hypothetical results are visibly distinguishable.
- Responsive desktop and mobile; avoid hidden unreachable editing actions.

## CI and integration
Use typecheck, unit tests, lint/build, fixture checks and at least one Playwright smoke once UI boots. No disabling failing tests to merge. Test fixtures are synthetic until source licenses are checked.

## First vertical slice
On synthetic Tennessee: open map; create/select A/B/C scenario; select one county; transfer five percentage points from A to C; verify local delta and state totals; undo, reset and JSON export/import; verify exact baseline and consistent UI. Capture test command/CI link/screenshot in PR.
