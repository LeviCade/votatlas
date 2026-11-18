# Votatlas — Living Conductor Handoff

## CHECKPOINT — NOVEMBER 17, 2026: ROUND SIX FULLY INTEGRATED

Repository: https://github.com/LeviCade/votatlas (public). `main` is NOT released. `integration` is the conductor branch.
Round Six production merge commit: `a4962e314230a7cc78e733f6f2bafc93d41c68ba`.
This handoff update is a documentation-only commit on top of that code.

### Round Six accepted PRs
- **E3 #39 — original 2024 ACS 5-year county population profiles**, merged `e3a7511b13dc28c51035d5c3e3032cd04259687d`. Direct original Census.gov B01001/B15003 source acquisition, original full-file SHA-256, 95 county row extracts, 6 age categories, 5 education categories, MOE and universe controls.
- **E2 #41 — hypothetical electorate composition fitter**, merged `74955f5327afd8fd7f34acb2103206ac391f38c1`. Pure deterministic composition → synthetic electorate allocation, explicit model assumptions, exact ballot conservation, canonical v3 source/assumption digest binding.
- **E1 #40 — source-backed demographic slider workbench**, merged `a4962e314230a7cc78e733f6f2bafc93d41c68ba`. Age/Education/Fictional tabs, explicit electorate weights, candidate support and turnout controls, 95-county MapLibre, Undo/Reset and v3 replay. Conductor added source-profile fingerprint validation on import: stale ACS composition projects are rejected rather than silently replayed against changed population data.

### Round Six verified evidence
**Original Census source acquisition:** run https://github.com/LeviCade/votatlas/actions/runs/44022061393 SUCCESS.
- B01001 original full table SHA-256: `1637b18a96881b81e050df1cd3d5ac38a33208b9b69b40e1dbeb3c4e13718f0e`.
- B15003 original full table SHA-256: `d0c8609e958022459215c8a31d7452ef7528ee8dd70fbb6f9a99de0f491f42d7`.
- Normalized 95-county fixture SHA-256: `0b8decedd5bd07fda6036f64305cecf5c6d63dfed5150b9cb47bc2423ac4d7de`.
- ACS 2024 5-year resident population: age 18+ = **5,499,414**; education 25+ = **4,870,330**. These are separate overlapping marginal universes, not registered voters, eligible voters, ballots or turnout.

**E3 exact-head:** native #44022069356, browser #44022069409, source audit #44022069379 — SUCCESS.
**E2 exact-head:** native #44022229670, browser #44022229708, source audit #44022229780 — SUCCESS.
**E1 combined E3+E2 exact-head `feafae9cdd6d4ae4c1ac35aa0138716cc47035e2`:**
- Native https://github.com/LeviCade/votatlas/actions/runs/44212971426 SUCCESS: 91 sim-core, 31 data, 36 web, 3 map tests; TypeScript/build/provenance green.
- Desktop/mobile Chromium https://github.com/LeviCade/votatlas/actions/runs/44212971481 SUCCESS, **34/34**.
- Historical SOS no-go audit https://github.com/LeviCade/votatlas/actions/runs/44212971466 SUCCESS.
- Screenshot/trace artifact #14387545495: https://github.com/LeviCade/votatlas/actions/runs/44212971481/artifacts/14387545495.
**Combined E3+E2 integration before E1 merge:** native #44212423910 and browser #44212424017 SUCCESS on `74955f5327afd8fd7f34acb2103206ac391f38c1`.
**Post-E1-merge integration CI:** triggered on `a4962e314230a7cc78e733f6f2bafc93d41c68ba`; verify current run status before further release work.

### Current behavior — important truth labels
- 95 Tennessee county Census 2020 boundaries; 95 county 2024 ACS 5-year age and education resident-population marginals from original Census-hosted source.
- B01001 groups resident population age 18+ into six disjoint age bands. B15003 groups resident population age 25+ into five disjoint attainment groups. Cross-table age-derived 25+ total reconciles to B15003 25+ county by county.
- Age and education are different overlapping marginals. Do not combine, stack or infer a joint age×education table.
- E2 fits one selected marginal into a **hypothetical synthetic electorate** using explicit user-selected category weights and county-neutral candidate preference at fit time. Candidate-specific support and turnout actions are separately hypothetical. No actual subgroup voting preference or turnout is inferred from Census population estimates.
- Candidate-neutral 2/3/5/10 candidate editor, county/multi-county/all-loaded-Tennessee scope, real MapLibre winner colors, exact source/ballot conservation, Undo/Reset, canonical source-bound v3 JSON.
- On composition-project import, E1 compares the saved profile fingerprint to the currently verified E3 profile; unavailable or changed source rejects import with a clear rebuild message.
- **All current election ballot counts are synthetic. No official Tennessee 2024 presidential county/precinct election results are released.** No all-US map, national election data, congressional district or precinct election scope.

### Historical Tennessee 2024 election source — STILL BLOCKED
Owner-supplied by-county PDF SHA-256 bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f; by-precinct PDF SHA-256 5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b.
95 counties/1862 precincts and seven-ticket printed total 3,063,942 reconcile, and SOS indexed by-office text corroborates the seven-ticket vector. But independently authenticated publisher binaries, all ballot categories/write-ins/undervotes, and rights/scope approval are still missing. Historical getter deliberately throws. Issue #20 OPEN. Retrieval requests: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf and https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx. See docs/SOURCE_RETRIEVAL_REQUESTS.md.

### Tracking
R5 Issues #30/#31/#32 closed. R6 Issues #36/#37/#38 closed by accepted PRs #40/#41/#39.
Code rights Issue #5 OPEN; Tennessee historical election data Issue #20 OPEN; `main` UNRELEASED.

### Ownership and operations
E1: `apps/web/**`, `packages/map/**`. E2: `packages/sim-core/**`. E3: `packages/data/**`, `scripts/**`, `.github/workflows/**`. Conductor: root, shared contracts, docs/prompts, integration merges and release approval.
No engineer self-merges. Verify exact heads, ownership, native CI, desktop/mobile browser acceptance, source provenance and rights. No proprietary ElectIndex code/assets/data. Census estimates never become observed election behavior.
Recovery after context loss: read this handoff, current GitHub integration head, active issue/PR and Actions. Do not rely on prior chat narrative.
