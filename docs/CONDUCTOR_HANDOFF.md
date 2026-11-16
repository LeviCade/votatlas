# Votatlas — Conductor Handoff

## LATEST CHECKPOINT — 2026-11-15: ROUND THREE COMPLETE; ROUND FOUR READY

Repository: https://github.com/LeviCade/votatlas (public)
Main: UNRELEASED; integration: active conductor branch.
Last fully verified merged R3 code SHA before this documentation checkpoint: b01d8c61e60311c477b645a08500860f2db1d00d.
The R4 kickoff SHA advances when this handoff is committed. ALWAYS use the pinned SHA in Issues #24-#26, not the old R3 SHA.

### Verified accepted work
R1: conductor #9, E3 #7, E2 #8, E1 #6.
R2: E2 #15, E3 #16, conductor root lock #17, E1 #14.
R3: E2 PR #22 portable v2 codec merged fc9434bf354ddd736ea07847e2dc90f712d7df6f. E3 PR #23 source-gated SOS ingestion merged ca6f277fa7edee06b5aaea239b461d49bfbcd32f. E1 PR #21 custom candidate UI and real-map winner flip merged b01d8c61e60311c477b645a08500860f2db1d00d.

### CI
R3 merged integration native workspace SUCCESS: https://github.com/LeviCade/votatlas/actions/runs/43801393235
R3 merged integration desktop/mobile Chromium SUCCESS: https://github.com/LeviCade/votatlas/actions/runs/43801393353
Combined E1 and E2 premerge integration native PASS 43801255595 and Playwright PASS 43801255634.
E3 source access audit 43800350894 documents HTTP 403; SUCCESS means the NO-GO was enforced, not source verified.

### Actual implemented behavior
- All 95 real Census-derived Tennessee county shapes in MapLibre, 2020 geographic vintage.
- All CURRENT election vote totals remain SYNTHETIC (Aster/Briar/Cedar fixture); no true historical vote data displayed.
- Candidate-neutral adjustments, live county/state totals, Undo, Reset, verified leader/color flip for Davidson County (Aster #7544A6 to Cedar #B47F15 after 7pp transfer).
- Custom candidate add/rename/guarded removal; 2/3/5/10 candidate views; canonical v2 source-fingerprinted project import/export with preserved candidates/history and v1 legacy support.
- No demographic cohort math released or observed voter-preference distributions, no national/all-US dataset, no district/precinct support.
- Historical TN 2024 provenance and tested ingestion scaffold exists but fixture remains explicitly BLOCKED and getter throws.

### Issues and gates
- Issue #4 first playable synthetic county sandbox: CLOSED and accepted.
- E1 #18 and E2 #19: CLOSED.
- Issue #20 authentic 2024 official county data: OPEN, blocked pending SOS source bytes, candidate/write-in scope and rights signoff.
- Issue #5 software license/data rights: OPEN. No public main release or official fixture until resolved.
- R4 E1 #24 geographic scopes; prompt prompts/ENGINEER_1_ROUND_4.md.
- R4 E2 #25 synthetic disjoint cohort computation; prompt prompts/ENGINEER_2_ROUND_4.md.
- R4 E3 #26 official source authentication; prompt prompts/ENGINEER_3_ROUND_4.md. Fully standalone for new engineer chat.

### Conductor and ownership
E1 apps/web/** packages/map/**. E2 packages/sim-core/**. E3 packages/data/** scripts/** .github/workflows/**. Conductor root, contracts, docs, prompts, reviews, lockfile, merges.
No engineer cross-owner edits. All PRs target integration. Check live GitHub SHAs, actual native CI, browser screenshots, dataset rights and contract compatibility BEFORE merging.
No copied ElectIndex source/assets/data. Never call synthetic votes observed.
Recovery: read this handoff and issue comments, fetch live integration and PR/CI status; audit exact diffs; update this file after each accepted merge.
