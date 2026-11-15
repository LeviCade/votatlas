# Shared Contracts — v0.1

The canonical TypeScript definitions live in packages/contracts/src/index.ts; this document explains their semantics. **Conductor owns this contract.** Engineer requests for changes go through GitHub issues.

- Candidate IDs and GEOIDs are opaque stable strings; never assume candidate #0 is Democratic or candidate #1 is Republican.
- County is the v0.1 atomic unit. Five-character FIPS codes retain leading zeroes. A county has exactly one owning state for the chosen fixture vintage.
- Candidate vote counts are nonnegative integers; otherBallots is tracked separately. A total ballot denominator must state whether it includes otherBallots.
- Each election has its own candidate registry, geography vintage, provenance status and immutable base results.
- Scenario version 1 records election ID and an ordered list of typed actions.
- Scope union includes nation, state, county, district and precinct, but v0.1 engine is obliged to support only nation/state/county; unsupported scopes must fail explicitly rather than silently approximate.
- SET_SHARE uses candidate-ballot denominator and a named redistribution rule. TRANSFER_PP names source/destination IDs and is measured in percentage points of aggregate candidate ballots. TURNOUT_SCALE has a factor and stated allocation rule.
- SimulationResult contains atomic-unit rows and rollups derived from them, plus model provenance. Winner is a candidate ID or null for ties/zero ballots.
- Identical inputs plus identical action order must return identical integer results; zero actions must preserve exact baseline counts.

Contract changes require conductor approval and synchronized tests across UI, data and engine.
