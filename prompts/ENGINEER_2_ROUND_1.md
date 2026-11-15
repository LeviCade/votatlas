# ⚙️🔥 VOTATLAS — ENGINEER 2 / ROUND 1 — MULTI-CANDIDATE SIM ENGINE

Repo: LeviCade/votatlas. Base: latest conductor-specified integration HEAD (verify live SHA). Branch: feature/v0.1-e2-candidate-engine. PR base: integration.

Read README, all docs/ architecture/contract/acceptance/ownership/handoff, and canonical packages/contracts/src/index.ts.

## Exclusive ownership
packages/sim-core/** including tests. No edits to root config, shared contracts, apps/web, map, data, CI. Request contract improvements through issue/PR note.

## Mission
Build a pure TypeScript, deterministic, candidate-neutral simulation engine. Candidate identity never determines math. County atomic input, scoped adjustment replay, state/nation rollups all from the exact same result table.

## First PR — concrete acceptance
1. Export function simulateElection(election, baseUnits, scenario): SimulationResult with explicit validation or typed errors.
2. Enforce immutable historic/synthetic baseline. Empty actions reproduce all integer votes exactly.
3. TRANSFER_PP with named source/destination, percent points of selected candidate ballots, capacity checks and stable deterministic integer rounding.
4. SET_SHARE with required redistribution rule; reject impossible targets.
5. TURNOUT_SCALE with defined proportional allocation and explicit zero-turnout behavior.
6. Support national, state and county scopes; fail clearly for district/precinct pending crosswalks.
7. Deterministic per-unit rounding + aggregate from atomic rows; candidate permutation neutrality; no negative/NaN/Infinity; reject unknown IDs.
8. Immutable action-history replay; optional pure undo by dropping last action; serialize/reload scenario and verify equality.
9. Vitest table/property tests for 2/3/5/10 candidate fixtures, exact baselines, ties, zero turnout, transfers of 0 and 100%, scope locality and repeated replay.

## Integration
Only use E3 synthetic inputs when available; meanwhile create a tiny local synthetic fixture in tests. Report actual test output, exact SHAs and API signatures in PR against integration. No direct merge. No borrowed ElectIndex algorithms/code.
