# VOTATLAS — ENGINEER #2, ROUND SIX: COMPOSITION-AWARE SYNTHETIC ELECTORATE

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r6-e2-composition-model
Target: integration. Issue #37.
Starting SHA pinned in Issue #37.
OWNERSHIP: packages/sim-core/** only.

Read R5 canonical v3 project codec, R4 cohort engine, R5 demo generator, conductor handoff and Issues #36/#37/#38. Publish typed proposed input/output API to E1 and E3 immediately.

Build a pure deterministic bridge from real source-labeled Census county POPULATION marginal counts to an EXPLICITLY HYPOTHETICAL modeled electorate cohort partition. Census composition is NOT an estimate of observed subgroup candidate support or turnout.

Rules: one marginal dimension at a time; categories form a complete disjoint partition of one named population universe in each county; adult Age 18+ and Education 25+ have distinct denominators. Never infer joints from marginals, never treat population totals as ballots or registered voter counts. Require an explicit modeled voter/eligible weighting assumption and disclose it. Match each existing county's candidate ballots, other ballots and eligible capacity exactly under deterministic integer allocation. Reject missing counties, suppressed estimates, overlap, invalid source digest, different universes, overflows, negative figures, incorrect candidate registry, malicious input.

Export SyntheticCohortPartition and auditable assumptions/provenance suitable for the existing canonical v3 project codec. Preserve v1/v2/v3 backward compatibility and source fingerprint. If a new project schema is needed seek conductor approval first; do not silently change v3. Keep fictional generator supported.

Tests: 95 TN counties, 2/3/5/10 candidates, 100+ actions, county/multi/state, candidate neutral conservation, exact replay, source-vintage/MOE metadata, age vs education mismatch, all-scope aggregation, null and zero cells. Native Vitest and GitHub CI. PR to integration; do not merge.
