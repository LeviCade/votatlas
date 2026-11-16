# 🛡️🇺🇸 VOTATLAS — ENGINEER #3, ROUND THREE: FIRST OFFICIAL HISTORICAL ELECTION

**This assignment is intentionally COMPLETE for a fresh ChatGPT chat. Prior Engineer #3 chat history is not required.**

Repository: https://github.com/LeviCade/votatlas (PUBLIC).
Conductor working branch: `integration`; default main is NOT the release branch.
Your work branch: `feature/v0.1-r3-e3-official-tn-2024`.
PR target: `integration`.
GitHub issue: #20.
Starting SHA: the exact conductor-pinned Round Three commit in the latest Issue #4 kickoff comment; verify your branch head matches it and record the SHA before modifying anything.

## Project context
Votatlas is an independently implemented, candidate-neutral election sandbox. Three engineers work concurrently and the Conductor reviews/merges. Round Two delivered: React/MapLibre live 95-county Tennessee synthetic sandbox; pure deterministic engine (now supports safe hypothetical candidate registration); verified 2020 Census-derived Tennessee county GeoJSON and provenance; real browser smoke screenshots; frozen pnpm CI. All three R2 PRs #14/#15/#16 merged; conductor PR #17 fixed root pnpm lockfile. **All R2 functionality is on integration, NOT main.** No copied ElectIndex JS/data.

Read these exact repo files first:
- `docs/CONDUCTOR_HANDOFF.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTRACTS.md`
- `docs/ENGINEERING_OWNERSHIP.md`
- `docs/TESTING_AND_ACCEPTANCE.md`
- `prompts/ENGINEER_3_ROUND_3.md`
- `packages/data/README.md`, fixture manifests, `packages/data/src/index.ts`, current generation/validation scripts
- GitHub issue #20 and E1 issue #18 (coordinate future fixture selection).

## Your ownership
You may ONLY edit `packages/data/**`, `scripts/**`, `.github/workflows/**`. The conductor owns `packages/contracts/**`, root `package.json` and `pnpm-lock.yaml`, `docs/**`, `prompts/**`, PR merges and final release. Engineer #1 owns `apps/web/**`, `packages/map/**`; Engineer #2 owns `packages/sim-core/**`. Cross-owner issues must be raised explicitly; do not work around them.

## Primary mission
Introduce our FIRST *genuinely observed*, historically accurate Tennessee election fixture: the November 5, 2024 presidential election by county, sourced primarily from the Tennessee Secretary of State's official certified county/precinct result records, not from a news-site election-night crawl or proprietary map dataset. Preserve the existing 95-county synthetic fixture untouched.

## Sources and difficult reconciliation
- Seek official Tennessee SOS original county and precinct results for 2024 President/Vice President. Preserve original source file URL, release/certification date, byte checksum and exact method for county-by-county extraction. State records do NOT automatically inherit federal 17 USC 105 public-domain status; perform explicit redistribution-rights analysis rather than assume.
- Secondary comparison resources may help locate source discrepancies, but not replace an authentic original SOS record. In particular, some displays quote 3,063,942 as the summed printed presidential candidate total while others include additional write-in votes; **DO NOT silently choose whichever total is convenient**. Record precisely which official result rows count as candidates, write-ins, other ballots, undervotes and total ballots cast, and explain difference in denominators. Cross-check all 95 county values and the separately reported statewide totals.
- Represent every officially reported ticket as a stable candidate ID when supported by original source. For write-ins that cannot be resolved per named candidate, clearly document aggregation into `otherBallots` or separately modeled candidate grouping; never invent unsupported vote lines.
- Do not import synthetic 2026 eligible-voter figures into actual 2024 data. Use `eligibleVoters: null` unless verified for the same election/definition, then document.
- Preserve 2020 Census five-digit county GEOIDs for geography joining; explicitly acknowledge any source-year naming/crosswalk differences.

## Acceptance gates
1. Reproducible ingest script from pinned official file or verified local authoritative source bytes, not hand-keyed result tables.
2. Fully validated `ElectionDataset` with exactly 95 distinct TN GEOIDs sorted, proper candidate registry, integer vote totals, source status `official` ONLY if authenticated, candidate/ticket names, office, year and geography vintage.
3. Separate manifest with official source URL, rights, checksums, row extraction/reconciliation, known exclusions and transformations. No missing county/office entries converted to zero silently.
4. Signed-off statewide totals and per-county sums. Explicit regression tests for swapped county, missing row, duplicate GEOID, unknown candidate ID, write-in handling and altered source bytes.
5. Public API such as `getTennessee2024PresidentialFixture()` returning an immutable-isolated copy, alongside provenance getter, with interface compatible with current data/engine. Preserve `getTennesseeSyntheticFixture()` and `getTennesseeRealCountyGeoJSON()`.
6. Frozen pnpm GitHub CI, native Vitest, fixture generation reproducibility, existing geometry validation and no accidental change to legacy synthetic ballot fixture or 955 KB geometry.

## HARD STOP CONDITIONS FOR THE DATA, NOT YOUR ENGINEERING WORK
If you cannot authenticate complete county rows or confirm data rights, DO NOT ship anything labeled `official`. Instead deliver a documented no-go provenance report, a reusable parser/validator scaffold and PR with tests. No guessed or fabricated source rows.

## Delivery
Commit your source and tests on `feature/v0.1-r3-e3-official-tn-2024` and open a PR into integration. Report exact start/HEAD SHAs, 95 county count, statewide totals from YOUR SOURCE, source URL/checksum, accepted/failing tests, changed files and any rights uncertainty. Coordinate the exported API with E1 via Issue #18, but do not edit their directories. **Never merge your own PR.**

Your engineering mission: make Votatlas historically credible while keeping synthetic modeling visibly separate from observed data. 🛡️
