# Votatlas — Living Conductor Handoff

## CHECKPOINT: NOVEMBER 16, 2026 — ROUND FIVE ACCEPTED; ROUND SIX PREPARED

Repo: https://github.com/LeviCade/votatlas (public). main is NOT released. integration is conductor branch.
Last fully verified R5 production SHA before this docs commit: c4e4a4673cbef44d2c620e94bcb9909ddf3fe8cf.
Exact R6 kickoff SHA will be pinned to Issues #36/#37/#38 after this documentation commit. Read live GitHub instead of assuming old SHA.

### Accepted work
R1 E1 #6, E2 #8, E3 #7, conductor root lock #9.
R2 E1 #14, E2 #15, E3 #16, conductor #17.
R3 E1 #21 (custom candidates, map winner flip), E2 #22 (v2 portable projects), E3 #23 (historical ingest scaffold).
R4 E1 #27 (county/multi/state scopes), E2 #29 (synthetic disjoint cohort engine), E3 #28 (paired Tennessee election PDF audit).
R5 E2 #35 canonical v3 cohort project and fictional seed model merged 3a339c9523f188aae31fab23cfc24ac44741b581.
R5 E3 #33 SOS by-office publisher text corroboration, source audits and no-go safeguards merged 85854528fb8117958d7568f5e5f032b8c9409281.
R5 E1 #34 functioning Model Lab, county/multi-state cohort edits, model Undo/Reset, actual v3 export/import merged c4e4a4673cbef44d2c620e94bcb9909ddf3fe8cf. Conductor supplied E2 canonical seeded model provenance in E1 adapter and repaired test locator.

### Combined R5 verification
Full workspace native CI: https://github.com/LeviCade/votatlas/actions/runs/43900581706 SUCCESS on c4e4a467.
Desktop/mobile Playwright: https://github.com/LeviCade/votatlas/actions/runs/43900581793 SUCCESS on same SHA.
E1 enabled-model branch test native https://github.com/LeviCade/votatlas/actions/runs/43900047780 and browser https://github.com/LeviCade/votatlas/actions/runs/43900047748 both SUCCESS, artifact #14241112305.

### Current functionality and strict truth
- 95 actual Census-derived TN 2020 county polygons, candidate-neutral 2/3/5/10 hypothetical candidate editor, live county/multi/state selection, map winner colors, Undo/Reset, v1/v2 import and canonical v3 source-bound model project save/restore.
- Model Lab supports fictional 3-group age-like synthetic cohort split, support transfers, turnout edits, all loaded TN scopes, model Undo/Reset and scenario replay, with live map and scoreboard. Tests activate model, no disabled-generator-only acceptance.
- All current *election ballots and demographic voting preferences* are FICTIONAL. No verified TN 2024 historical observed county ballots released, no empirical subgroup vote, no US national map.
- Round Six goal: official source-labeled 2024 ACS 5-year COUNTY POPULATION demographic composition estimates for age and education; pure modeling of hypothetical electorates and sliders. ACS categories do not observe how anyone voted. Single partition at a time.

### Historical 2024 election source: STILL BLOCKED
Owner by-county PDF 28 pages SHA-256 bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f, by-precinct PDF 225 pages SHA 5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b.
95 counties, 1862 precincts independently reconciled seven-ticket presidential total 3,063,942. Tennessee SOS publisher indexed by-office text confirms ticket vector, but independent upstream binary identity not available due HTTP403; no approved seven-ticket-only reporting scope, write-ins/undervotes missing, code/data rights issue #5 unapproved. Official fixture getter still throws; Issue #20 OPEN. Needed owner downloads: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf and https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx. Retrieval checklist docs/SOURCE_RETRIEVAL_REQUESTS.md.

### Tracking
R5 Issues #30 E1, #31 E2, #32 E3 completed by accepted PRs.
R6 E1 Issue #36 / prompts/ENGINEER_1_ROUND_6.md.
R6 E2 Issue #37 / prompts/ENGINEER_2_ROUND_6.md.
R6 E3 Issue #38 / prompts/ENGINEER_3_ROUND_6.md (new chat standalone).
Code rights Issue #5 OPEN, historic data gate Issue #20 OPEN, main UNRELEASED.

### Ownership and operations
E1 apps/web/** packages/map/**. E2 packages/sim-core/**. E3 packages/data/** scripts/** .github/workflows/**. Conductor root/contract/docs/prompts/CI merges/release approval.
All engineers fetch pinned R6 SHA from latest issues, only edit own files, PR against integration, never merge. Conductor verifies exact head diff, tests, combined integration native+Playwright, source/copyright rights and provenance.
No proprietary ElectIndex code/data/graphics. No pretending Census population estimates are election voter behavior. Recover after context timeout: read this handoff + exact R6 issue comments + GitHub live PR and CI, not old assistant narration.
