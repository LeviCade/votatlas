# ⚙️🔥 VOTATLAS — ENGINEER #2, ROUND THREE: PORTABLE SCENARIO PROJECTS

Repository: https://github.com/LeviCade/votatlas
Branch: `feature/v0.1-r3-e2-portable-scenarios`.
Target: `integration`.
Issue #19.
Start from the exact Round Three base SHA pinned in Issue #4. Record it in PR.

Read docs/CONDUCTOR_HANDOFF.md, docs/CONTRACTS.md, existing candidate-registry.ts, engine.ts and E1 Issue #18. Own ONLY `packages/sim-core/**` and its tests/docs. Do not modify conductor contracts, root lockfile, data or UI.

## Mission
V1 scenario JSON saves adjustment actions but NOT a custom candidate registry; after adding a hypothetical candidate, restoring v1 JSON in a new browser session loses that candidate. Fix this carefully with a versioned portable scenario-project package, while retaining backwards compatibility and strict provenance.

## Requirements
1. Implement typed, pure functions for creating, serializing, parsing and restoring a versioned `ScenarioProject` v2. Prefer a compact description of source election/fixture identity, source digest/vintage, candidate additions and renamed metadata, and ordered v1 adjustments rather than embedding untrusted arbitrary replacement baseline rows.
2. Require caller-supplied canonical trusted source baseline to hydrate imported projects. Reject fixture ID/digest mismatches, unexpected base registry alteration, duplicated/reserved IDs, malformed colors, oversized payloads and unknown schema versions; avoid prototype pollution.
3. Reproduce exact historical actions when candidates are added after older proportional-other adjustments (preserve original donors). Ensure v2 export -> import -> replay is numerically identical for 2/3/5/10 candidates and 95-county fixtures, with zero unexpected ballot creation or loss.
4. Make removal scenario-aware: zero *baseline* support is insufficient if current active actions give candidate votes or reference it. Reject or require explicit safe resolution; never silently delete votes, source history or action references.
5. Keep immutable v1 Scenario and its existing parseScenario/serializeScenario behavior unchanged for legacy cases; document v1 vs v2 compatibility, known limitations, and distinct source-vs-scenario state.
6. Provide stable exported API/types to E1 via Issue #18 early, then write thorough native Vitest/regression and seeded 100+ action tests. Do not claim CI based only on an offline harness.

No permission to change canonical contracts without conductor agreement; implement package-scoped types as necessary. No proprietary third-party source. Open PR to integration, no self-merge.
