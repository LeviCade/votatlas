# Votatlas — Living Conductor Handoff

## LATEST CHECKPOINT — NOVEMBER 15, 2026 LOCAL: R4 INTEGRATED; R5 ENGINEERING ASSIGNMENTS PREPARED

Repository: https://github.com/LeviCade/votatlas (public).
main is unreleased. integration is the active conductor branch.
R4 final integrated production-code SHA before R5 documentation: 4f7b360662a5c9ed3509792ab6b54a1b964c4166.
DO NOT use this R4 code SHA as R5 kickoff after documentation updates. Use the exact NEW R5 starting SHA pinned in Issues #30/#31/#32.

## Merged work, by round
R1: E1 PR #6, E2 #8, E3 #7 and conductor root #9.
R2: E1 #14, E2 #15, E3 #16, conductor root lock #17.
R3: E1 #21 custom candidate UI and canonical v2 project support, E2 #22 verified portable projects, E3 #23 source ingestion scaffold. Real MapLibre leader flip verified.
R4:
- E2 #29 merged 383d601a923f064c2f695ba0bb2b8c325f2e347b (experimental explicitly synthetic disjoint-cohort candidate-neutral math).
- E3 #28 merged fb98f10dab41b93a0e5b407e810c4a9c2d69a1aa (owner PDF source hashes, precinct/county independent audit; original 2024 results still blocked).
- E1 #27 merged a5f2576a06eebda63cfac1237f5572dceb7646ea (county, multi-county, all-TN map scopes and contextual UI; 18/18 real browser tests).
- Conductor minor exact approvalStatus writer/getter consistency fix integrated 4f7b360662a5c9ed3509792ab6b54a1b964c4166.

## Verified R4 integrated CI
Native workspace source/TypeScript/Vitest/build/provenance: https://github.com/LeviCade/votatlas/actions/runs/43804348350 SUCCESS at 4f7b360.
Desktop/mobile real Chromium: https://github.com/LeviCade/votatlas/actions/runs/43804348341 SUCCESS at same SHA.
Individual PRs #27/#28/#29 also each have latest-head green native and browser workflows recorded in their GitHub PR descriptions.

## Working
- 95 real 2020-vintage Census TN county shapes, synthetic votes, live candidate-neutral engine and dynamic candidate registry.
- MapLibre winner colors, interactive county, user multi-county and loaded Tennessee statewide scope (state GEOID 47), accessible list, area totals/margins, Undo/Reset, canonical source-bound v2 scenario project import/export. No true US nationwide dataset.
- Synthetic-only disjoint cohort model pure package API in sim-core, cohort support transfers and turnout, candidate-neutral and integer safe. Cohort modeling is NOT exposed by UI or persisted in v2 projects yet, and no actual voter-group preference measurements are available.

## 2024 official historical data STATUS: STILL BLOCKED
- Owner delivered two original-format State of Tennessee reports via conversation upload. Independently computed hashes:
  by-county 28 pages SHA256 bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f
  by-precinct 225 pages SHA256 5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b.
- Independently parsed 95 counties, 1,862 precincts, exactly matching all seven candidate totals [1966865,1056265,5865,3457,988,21535,8967] sum 3,063,942. The owner copies and official public SOS searchable text concur on reported results; publisher binary byte identity not independently established due HTTP403.
- Historical fixture metadata remains releaseApproved false, dataStatus blocked; no populated official JSON, getter throws. Rights/denominator decision not made.
- Seven-ticket total is NOT complete voting turnout, write-in/undervote or eligible voter data. Those categories remain unknown.
- Source acquisition checklist and two next needed files: docs/SOURCE_RETRIEVAL_REQUESTS.md.

## Issue tracking
- Completed: first playable synthetic gate #4, R3 #18/#19, R4 #24/#25/#26.
- Open #20 authentic historical 2024 fixture until all source, ballot-scope and rights gates satisfied.
- Open #5 license and data-rights release gate. No main promotion until owner selects software license and sources checked.
- NEW R5 issues: E1 #30 (synthetic Model Lab UI), E2 #31 (canonical v3 cohort project persistence), E3 #32 (official 2024 source/rights/ballot authentication).
- New assignments at prompts/ENGINEER_1_ROUND_5.md, ENGINEER_2_ROUND_5.md, ENGINEER_3_ROUND_5.md.

## Ownership and integration discipline
E1 apps/web/** and packages/map/**. E2 packages/sim-core/**. E3 packages/data/**, scripts/** and .github/workflows/**. Conductor owns root/contracts/docs/prompts/merges.
Only E2 authors canonical v3 serialization. E1 must not revive a parallel browser codec; if E2 isn't ready, leave synthetic modeling export unavailable.
No unsupported voter demographic inference or third-party proprietary code. All engineers work on separate branches from identical pinned R5 SHA, open PR targeting integration and NEVER self-merge.
Conductor audits full code diff, actual latest GitHub CI, source rights and shared interfaces and retests after combined merge.
