# Tennessee 2024 ACS 5-year — verified demographic population dataset

**Publisher:** United States Census Bureau. **Product:** 2020–2024 American Community Survey 5-Year Detailed Tables, published January 29, 2026. **Scope:** Tennessee's 95 counties, Census GEOID state FIPS 47 and pinned 2020 county crosswalk. **Status:** directly acquired from the original Census.gov table-based Summary File via GitHub Actions; completely independent of Tennessee's still-blocked election data.

Official source document: https://www.census.gov/programs-surveys/acs/data/summary-file.2024.html

Full original table paths:
- B01001: https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b01001.dat
- B15003: https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-b15003.dat

The independently executed official-source acquisition on the E3 feature branch downloaded both **complete original source binaries** via HTTPS, computed their SHA-256 before transformation, extracted exactly 95 original county lines (50-level GEO_ID prefixes 0500000US47xxx), and verified each demographic partition without substitution. GitHub Actions job evidence is available on the acquisition workflow run. Source files use the official Census pipe-delimited Summary File header of GEO_ID and paired variables B01001_E001/B01001_M001 through E049/M049, and B15003_E001/M001 through E025/M025. All original county rows are preserved in small committed .dat files. The full 200 MB+ source binaries are represented by their original file SHA-256 and URL, not redistributed.

**Raw source and derived fixture fingerprints** are recorded in fixtures/tennessee-acs-2024-provenance.json. The check mode regenerates and validates against pinned original extract bytes and exact JSON output. A source file mutation, duplicate or unknown 47xxx GEOID, negative/sentinel estimate, missing estimate/MOE cell, incorrect table variable sequence, or population total mismatch fails. No interpolated or fabricated Census counts.

## Exact source population universes

**Age (B01001):** total population estimate E001, male E002, female E026. Children E003–E025 and E027–E049 must sum to male/female parents respectively and E001 combined. Derive a single partition of **resident population aged 18 and older**, with disjoint six bands:
- 18–24: E007–E010 and E031–E034
- 25–34: E011–E012 and E035–E036
- 35–44: E013–E014 and E037–E038
- 45–54: E015–E016 and E039–E040
- 55–64: E017–E019 and E041–E043
- 65+: E020–E025 and E044–E049

Confirm each county sum of all six groups equals total population minus under-18 male/female cells. Statewide Tennessee sum: **5,499,414 persons 18+**, across 95 counties (source B01001 2024 ACS 5-year population total 7,066,383). This does NOT represent all eligible voters.

**Education (B15003):** estimate E001 is the **resident population aged 25+**, and disjoint 24 detailed attainment cells E002–E025 must sum to that total. Group into five exclusive categories:
- Less than high-school diploma E002–E016
- High-school graduate or GED/equivalency E017–E018
- Some college or associate degree E019–E021
- Bachelor's E022
- Graduate or professional degree E023–E025

Statewide Tennessee sum: **4,870,330 persons aged 25+**. The 25+ denominator must never be substituted for 18+; the two marginals overlap and do not supply an age-by-education joint distribution. In the genuine source, each county's adult B01001 population minus 18–24 also equals the corresponding B15003 population 25+; this independent cross-table control is verified during source generation.

## Survey estimates, uncertainty and reuse

2024 ACS five-year estimates are survey estimates of the **resident population**, not registered voters, election voters, presidential votes, turnout, or subgroup party preference. Recombining source cells creates synthetic analytical groups, NOT fictional population counts. The fixed number of age/education groups are mutually exclusive inside their own marginal dimensions only. Never stack age and education columns, infer a 6×5 cross-tab or apply unobserved candidate support.

Original source 90%-confidence MOEs are preserved as raw source B01001_M### and B15003_M### columns alongside estimates. Negative and Census 9-digit MOE sentinel codes such as 555555555 are flagged unavailable/null; they are never zero observations or numeric MOEs. The base B15003 25+ universeMOE is shown if reported. Derived age adult universe and regrouped multi-variable category MOEs remain null because covariance required for an exact MOE is unavailable. The single-source educational bachelor's category retains its original B15003_M022 90% MOE when reported. Raw original MOEs remain auditable. See official Census technical documentation before inferring any significance.

**Ownership/rights:** U.S. federal Census statistical data under 17 U.S.C. 105; attribution: U.S. Census Bureau, 2024 ACS 5-Year Detailed Tables; no implied Census endorsement. No third-party normalized election or demographic datasets used. Original Census source data does not change historical Tennessee SOS presidential election status: the election fixture remains blocked and its public getter throws.

## Reproduction

1. Download both unmodified original .dat files from Census-host URLs above.
2. Run: node scripts/generate-tennessee-acs-2024.mjs --write --age-full /path/acsdt5y2024-b01001.dat --education-full /path/acsdt5y2024-b15003.dat
3. Run: node --test scripts/acs-2024-validation.test.mjs
4. Run: node scripts/generate-tennessee-acs-2024.mjs --check
5. Verify package build/TypeScript and Vitest CI.

Typed public exports: getTennesseeAcs2024CountyMarginals('age'|'education'), getTennesseeAcs2024Provenance(), and getTennesseeAcs2024CompositionSourceProvenance('age'|'education'). All outputs are detached, recursively frozen copies. The composition adapter exposes exactly E2's source model interface but does not apply turnout or candidate assumptions; only E2's hypothetical modeling code may do that.

If a fresh official binary changes SHA unexpectedly, investigate publisher revisions and reconcile before updating the manifest. The offline checker will catch unauthorized rows or output changes.