# Votatlas — Living Conductor Handoff

## CHECKPOINT — 2026-11-15 / ROUND TWO ACCEPTED, ROUND THREE PLANNED

Repo: https://github.com/LeviCade/votatlas (public).
Default branch: `main` (NOT RELEASED, still kickoff).
Conductor work branch: `integration`.
**Last fully CI-verified R2 integration SHA (before this documentation commit):** `1d7a4fcbeb9784d298d027ca1fd79289d572a1ef`.
After this checkpoint commit, obtain LIVE `integration` SHA from GitHub rather than reusing this old code SHA. R3 branches are to be created from one identical docs-published integration head; Issue #4 kickoff comment will pin it.

### Accepted code, exact merge SHAs
R1 conductor lock PR #9: `3c5bc363264969910410959e99b36b844e29d4ca`.
R1 E3 data/CI PR #7: `306fc7304d27a5f69bb196740b1c24c5e7bd32bc`.
R1 E2 engine PR #8: `e9a5285bf6b096dda220ba154058e8b2175d4c17`.
R1 E1 preview PR #6: `1de74c9a6a021052dac381a41d929e716cd5c7ae`.
R2 E2 candidate-registry PR #15: `bfe50b3381283c33663a3704c7da937096df0a95`.
R2 E3 real Census geometry PR #16: `520f977bc6032fdb437263de69e82ce9c8c21210`.
R2 conductor root pnpm-lockfile PR #17: `35b16e6287d488d81d0dc92a33b41702d6fd37f4`.
R2 E1 live 95-county UI PR #14: `1d7a4fcbeb9784d298d027ca1fd79289d572a1ef`.
All merged to integration with squash reviews; R2 issues #10–13 closed.

### GREEN VERIFIED CI — 2026-11-15
Full workspace: https://github.com/LeviCade/votatlas/actions/runs/43797036632 (SUCCESS on merge SHA 1d7a4fcb).
Desktop+mobile Chromium smoke: https://github.com/LeviCade/votatlas/actions/runs/43797036661 (SUCCESS on merge SHA 1d7a4fcb).
PR #14 combined CI: https://github.com/LeviCade/votatlas/actions/runs/43796889146 and browser https://github.com/LeviCade/votatlas/actions/runs/43796888926 (both SUCCESS).
PR #15: https://github.com/LeviCade/votatlas/actions/runs/43793452448.
PR #16: https://github.com/LeviCade/votatlas/actions/runs/43793974896, pinned-source regeneration https://github.com/LeviCade/votatlas/actions/runs/43793969142.
Conductor real-pnpm lock bootstrap https://github.com/LeviCade/votatlas/actions/runs/43796510479 (SUCCESS; temporary privileged workflow REMOVED before PR #17).

### FUNCTIONAL PRODUCT (currently synthetic only)
- App uses real Census-derived TN 2020 county shapes (95 GEOIDs) through MapLibre. Real map is visible in passing Chrome screenshots.
- `getTennesseeSyntheticFixture()`: 95 county vote records for Aster/Briar/Cedar, all fictional, explicitly marked synthetic. Candidate-neutral multi-candidate scoreboard.
- User can search/select Davidson (47037), transfer 5 percentage points from Aster to Cedar, and observe exact county and statewide recalculation from `simulateElection`; other counties unchanged.
- UI Undo, Reset, downloadable/importable v1 action scenario JSON, error handling, WebGL fallback, responsive layout. Desktop/mobile Playwright proves these.
- E2 pure `addCandidate`, `renameCandidate`, `removeZeroVoteCandidate` are available but **NO candidate editor in UI yet**. V1 scenario files omit expanded registry. E2 registry removal checks zero BASELINE votes, not active scenario history; E1 must not expose unsafe removal.
- **Map winner-flip color after >5pp changes not yet covered by browser test**; preserve Issue #4 release gate until expressly validated. Existing screenshots show real geometry and 5pp changes; this particular synthetic Davidson county remains Aster by a tiny margin after 5pp.
- Demographic controls disabled intentionally. No real elections/official vote results loaded yet. No national/district/precinct simulation.
- Code license not chosen, Issue #5 OPEN. `main` not promoted and no public release.

### Round Three planned work / owners
E1 Issue #18: UI custom candidate management, v2 scenario project integration, direct map leader-flip test. Prompt `prompts/ENGINEER_1_ROUND_3.md`, branch `feature/v0.1-r3-e1-custom-candidates`.
E2 Issue #19: pure versioned scenario-project serialization+hydration (expanded candidate registry + source identity), active-history removal safety, v1 backwards compatibility. Prompt `prompts/ENGINEER_2_ROUND_3.md`, branch `feature/v0.1-r3-e2-portable-scenarios`.
E3 Issue #20: first authoritative 2024 Tennessee presidential county return fixture, official source audit/rights/reconciliation. Prompt `prompts/ENGINEER_3_ROUND_3.md`, branch `feature/v0.1-r3-e3-official-tn-2024`. **E3 starts in a brand new chat; that prompt is fully self-contained.**
Conductor owns pnpm-lockfile, canonical contracts, final acceptances, docs, source rights release gate and merge order.

### Global control rules
- E1 owns apps/web/** packages/map/** only.
- E2 owns packages/sim-core/** only.
- E3 owns packages/data/** scripts/** .github/workflows/** only.
- Conductor owns root files, packages/contracts/**, docs/**, prompts/**, merges.
- Branch from current R3 exact integration HEAD after docs commit; not from main or old R2 branch.
- Native CI + Playwright must pass on true PR merged base, then on integration after acceptance.
- No copying ElectIndex scripts, bundled datasets, maps or visual assets. All observed data require independent authoritative source and licensing checks.
- Use technical truth: no 'official' label for synthetic votes or unverified secondary records, and no 'public release' without #5 resolution.

### Recovering in another chat
1. Query LIVE integration SHA, PR/issue heads, latest CI. Read this handoff, ownership, architecture, contracts, test plan and Round Three prompts.
2. Verify PR diff paths, exact HEAD SHA, CI job logs, numerical invariants, proof of browser behavior and source rights.
3. On approved PRs merge to integration; update this handoff. Regenerate root pnpm-lock.yaml via pinned pnpm if E1 adds workspace deps; don't disable frozen CI.
4. Main branch remains unpromoted until issue #4 final proof and issue #5 license/rights decision. Never infer chat activity from git without checking exact source.
