# VOTATLAS — ENGINEER #1, ROUND FOUR: GEOGRAPHIC SCOPE CONTROLS

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r4-e1-geo-scopes
PR target: integration
Starting SHA: exact Round Four integration SHA pinned in GitHub Issue #24.
Issue: #24
Exclusive ownership: apps/web/** and packages/map/**. No root, contracts, sim-core, data, or workflow edits.

FIRST: Read the latest docs/CONDUCTOR_HANDOFF.md, docs/ARCHITECTURE.md, docs/CONTRACTS.md, docs/TESTING_AND_ACCEPTANCE.md, all Round Four issue details and existing map/dashboard source.

MISSION: Take the verified 95-county Tennessee custom-candidate sandbox and make map-area selection truly flexible.

1. Provide scope selector: one selected county, a chosen set of counties, or all loaded Tennessee counties. Never misleadingly call the latter United States or Nationwide.
2. Implement accessible multi-county selection by map click and keyboard/touch search selection. Clear selection, show count and active scope, preserve map zoom across changes.
3. Produce canonical typed Adjustment scopes: stateId 47 for entire Tennessee, countyIds for selected counties. Recalculate only through sim-core; preserve candidate-neutral 2/3/5/10 candidate operation.
4. Render candidate totals and winner maps correctly for selected counties and distinct statewide totals. Add context and before/after differences, compact attractive map-first UI.
5. Keep canonical v2 project JSON source fingerprint, edits, hypothetical candidate registry, Undo/Reset, import/export and error handling working.
6. Test selected 3-county transfers, state-wide transfers, unchanged other county totals, exact aggregation and donor capacity. Test via real native CI and desktop/mobile Playwright with screenshots.
7. Do not enable demographic data UI based on unsupported estimates, and do not pretend 2024 historical election records are available before E3 release.

PR target integration, record head/base SHAs, tests and screenshots. DO NOT MERGE YOUR OWN PR.
