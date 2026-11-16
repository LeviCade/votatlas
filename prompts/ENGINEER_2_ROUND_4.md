# VOTATLAS — ENGINEER #2, ROUND FOUR: DETERMINISTIC DEMOGRAPHIC COHORT MATH

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r4-e2-demographic-core
PR target: integration
Starting SHA: exact conductor-pinned Round Four SHA in GitHub Issue #25.
Issue: #25
Exclusive ownership: packages/sim-core/**.

FIRST: Read docs/CONDUCTOR_HANDOFF.md, architecture, contracts, acceptance criteria, existing engine and canonical v2 scenario project module.

MISSION: Build a separate optional *synthetic modeled* cohort computation layer that does NOT invent observed demographic voting patterns.

1. Typed cohort-by-county-by-candidate integer vote partitions; every cohort is mutually exclusive within its declared partition dimension. Candidate sums and explicit otherBallots must exactly equal original county baseline values; otherwise reject.
2. Deterministic, candidate-neutral per-cohort support transfer and optional turnout scale, explicit voter universe and denominator, safe rounding and no negative values. Preserve mathematical conservation except when turnout is intentionally modified.
3. Never simultaneously apply overlapping demographic dimensions as if they represented distinct people. Require a verified joint partition for intersections, otherwise reject.
4. Return auditable new county BaseUnitResult rows and cohort-level deltas WITHOUT modifying trusted original data. Clearly label all tests and fixtures synthetic.
5. Validate unknown candidate, unknown cohort, duplicate ID, incomplete partitions, missing county, zero cells, impossible donor, invalid percentage, large numbers, deterministic ties and immutable replay.
6. Test 2/3/5/10 candidate registries, 95-county synthetic fixture, 100+ ordered operations and exact county/state sum consistency.
7. Preserve existing v1 action history and v2 source-verified scenario projects unchanged. Document a future UI integration interface for E1, but do not patch other engineer directories or present cohort edits as already serializable v2 actions.

Open a PR targeting integration, with native Vitest and workspace CI evidence. DO NOT MERGE YOUR OWN PR.
