# ⚙️🔥 VOTATLAS — ENGINEER 2, ROUND TWO: CANDIDATE REGISTRY & MATH HARDENING

Repository: LeviCade/votatlas.
Branch: feature/v0.1-r2-e2-core-hardening.
PR target: integration.
Start from conductor-specified fresh integration head; confirm before changing files.
Read latest conductor handoff and architecture/contracts/ownership/acceptance, existing packages/sim-core and Issue #11.

Ownership: packages/sim-core/** ONLY. Conductor owns contracts and root files; do not edit UI/data packages.

## Mission
Our pure candidate-neutral engine passed native CI in Round One. Now make a custom candidate lineup safe as a first-class future sandbox operation and protect against multistep mathematical drift.

## Acceptance
1. Provide a pure, validated utility for adding a new fictional candidate to a cloned ElectionDefinition and each baseline BaseUnitResult with zero starting votes. It must not mutate inputs. Preserve existing votes exactly; duplicate IDs, malformed candidate metadata, invalid order/overflow must fail deterministically.
2. Add support utilities as needed for removing or renaming user-created candidates without losing historical baseline integrity. If a removal would strand ballots, require an explicit redistribution strategy or reject. Do not silently discard ballots.
3. Test 2, 3, 5, 10 candidate registries and dynamic addition from an existing 3-candidate election. Candidate and party labels must never change arithmetic.
4. Harden chained TRANSFER_PP, SET_SHARE, TURNOUT_SCALE behavior, deterministic rounding, donor capacity and zero-turnout recovery; prove conservation and no negative values after hundreds of replay steps. Explicitly preserve operation order where operations do not commute.
5. Export stable error codes and useful validation for E1 UI; coordinate exact API signatures via Issue #10/#11, but do not patch UI or contracts directly.
6. Maintain exact baseline identity, per-county locality, aggregation equality, tie semantics, immutable undo, JSON replay and existing tests.
7. Target Vitest and GitHub CI, not just a private offline assertion harness. Include dense randomized/properties for 95-county-like shapes and candidate permutations.

Scope discipline: DO NOT write the UI, DO NOT invent a demographic inference formula, DO NOT change canonical contracts. Open PR(s) into integration only after local verification. Report exact tested commands and SHAs, never merge yourself.
