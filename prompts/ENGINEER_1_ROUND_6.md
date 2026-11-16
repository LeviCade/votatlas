# VOTATLAS — ENGINEER #1, ROUND SIX: SOURCE-LABELED DEMOGRAPHIC SLIDERS

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r6-e1-demographic-sliders
Target: integration. Issue #36.
Starting SHA: use conductor-pinned Round Six integration SHA on Issue #36.
OWNERSHIP: apps/web/** and packages/map/** only.

FIRST: Read living docs/CONDUCTOR_HANDOFF.md, full Round Six issue and current working R5 Model Lab. Coordinate exact typed APIs with E2 Issue #37 and E3 Issue #38.

MISSION: Make the functioning Synthetic Model Lab into an original, map-first demographic slider UI inspired by the ease of ElectIndex, not its proprietary code or bundled data. Allow a county, multiple counties and all loaded Tennessee selection; any candidate lineup; one disjoint Age or Education model at a time.

REQUIRED:
1. Right-side Age/Education tab, categorical subgroup selector and candidate-neutral support/turnout sliders with exact numeric feedback, beautiful map-first layout and mobile/keyboard accessibility.
2. Show distinct labels: real source-labeled 2024 ACS 5-year county POPULATION estimates and user-selected HYPOTHETICAL voting/turnout preferences. Adult age 18+ versus education 25+ denominators are NOT interchangeable and do not represent ballots/voters.
3. Consume E3 official source-based population composition data ONLY through typed data APIs; consume E2 fit-model API for modeled ballot partition. No browser-invented demographic shares and no overlap of different marginals. Until E2/E3 ready, keep clearly labeled fictional demo mode; never fake a real-source tab.
4. Preserve 95 real county polygons, 2/3/5/10 candidate IDs, map winner colors, selected county set, statewide totals, ordinary + model Undo/Reset, canonical v3 source-bound JSON import/export, accurate error handling and provenance. No local vote engine or alternative serializer.
5. Prove in actual desktop/mobile Chromium: real E3 data source metadata shown, model assumption explicitly disclosed, candidate transfer in 3 selected counties leaves 92 unaffected, model all-state turnout, custom candidate, map winner flip when possible, v3 persistence, source mismatch rejection, no early return/skip on missing R6 dependencies.
6. If required E2/E3 API is not yet integrated, document blocker, produce testable incremental UI, do not claim final acceptance.
Run native CI, browser tests, screenshots, unmerged PR. NO self-merge.
