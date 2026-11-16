# VOTATLAS — ENGINEER #1 / ROUND FIVE: DEMOGRAPHIC MODEL LAB UI

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r5-e1-model-lab
PR target: integration
Starting SHA: use exact pinned R5 SHA in Issue #30, NOT the prior round's SHA.
Issue: #30.
Exclusive ownership: apps/web/** and packages/map/**. Do not edit root, sim-core, data, workflows, docs or shared contracts.

FIRST: Read docs/CONDUCTOR_HANDOFF.md, the complete issue #30 and E2 interface issue #31. Audit current map/dashboard, v2 codec adapter, geographic scopes, R4 synthetic cohort engine and existing Playwright.

MISSION: Show the first actually functioning, clearly hypothetical demographic/COHORT sandbox on Tennessee, with attractive and accessible scoped controls, without representing fictional demographic preferences as observed.

REQUIRED:
1. Build a separate "Synthetic Model Lab" that an informed user opts into. Explain modeled/synthetic inputs and that no official subgroup-voting observations exist. Preserve the existing main 95-county, 2/3/5/10 candidate-neutral dashboard.
2. UI can select one declared disjoint cohort partition, choose a cohort, adjust candidate support (real engine COHORT_TRANSFER_PP) and turnout (COHORT_TURNOUT_SCALE) at 1-county, selected-county set or all Tennessee scope. Require complete partitions exactly matching the chosen pre-model baseline. No independent overlapping demographic sliders; multi-dimension needs explicit joint partition.
3. E2 owns deterministic synthetic demo fixture generation in R5. Consume its API, not a fabricated backend from your UI. Show exact assumptions and eligible capacity; never infer race/age/election preference from county election returns.
4. Show subgroup/county/area/state results and source-vs-model deltas with clear denominators. Never label selected Tennessee counties US or national. Original candidate fills stay unchanged until simulation changes their winners.
5. Save/load: E2 R5 is responsible for canonical v3 source-bound project codec. Coordinate the exact exported API directly on Issue #31. DO NOT invent a fallback v3 serializer. Until it is integrated, demographic-model save/load MUST be unavailable with explicit explanation rather than silently losing cohort history. Preserve existing v1/v2 input paths intact.
6. Design precise Undo for model actions and Reset for model vs whole project, source integrity, invalid partition feedback, and mobile/keyboard alternatives.
7. Test real browser: custom candidates, 3-county modeled transfer, other 92 counties unaffected, exact candidate conservation, multi-selection, statewide modeled turnout, replay, and imported source mismatch. Both desktop and mobile Chromium screenshots.
8. No historical 2024 official vote display until E3 release gate passes; no district/precinct claims or third-party proprietary code.

Deliver only E1-owned files, native CI, real desktop/mobile screenshots and open PR into integration; do not merge yourself.
