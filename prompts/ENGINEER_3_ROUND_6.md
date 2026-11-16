# VOTATLAS — ENGINEER #3, ROUND SIX: OFFICIAL CENSUS ACS COUNTY COMPOSITION

STANDALONE NEW-CHAT ASSIGNMENT. No prior session needed. All context is on GitHub.
Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r6-e3-acs-county-profiles
PR target: integration. Issue #38.
Starting SHA is pinned in Issue #38.
EXCLUSIVE OWNERSHIP: packages/data/**, scripts/**, .github/workflows/**.

FIRST: read living docs/CONDUCTOR_HANDOFF.md, source manifests, 95-county TN geographic fixture, Issue #38, and official Census API documentation at https://api.census.gov/data/2024/acs/acs5.html and examples https://api.census.gov/data/2024/acs/acs5/examples.html. Coordinate data API design with E2 Issue #37 and E1 Issue #36.

MISSION: Retrieve, validate and publish fully sourced 2024 ACS 5-YEAR marginal POPULATION composition estimates for all 95 TN counties with correct denominators. Start with:
- Detailed B01001 Sex by Age; form correctly summed 18+ age categories, retaining source variable IDs, original base counts and estimated margins of error where possible.
- Detailed B15003 Educational Attainment for Population 25 Years and Over; form disjoint attainment categories with the original 25+ denominator.
- Race/Hispanic ethnicity OPTIONAL only with nonoverlapping chosen groups and verified correct universe; do not double-count overlapping ethnicity/race marginals.

This is real Census population composition, NOT subgroup vote counts, registration, candidate preference, turnout, or eligible voter counts. The age 18+ denominator is different from education 25+. Do not force row groups to sum to election ballots. Preserve uncertain/suppressed/null values distinctly; do not fabricate zeros or adjust unexplained source mismatches.

Source integrity: source official API query and table ID, vintage, Census 2020 5-digit FIPS join, 95 county completeness, original source payload SHA or pinned source files, documented ACS estimation/MOE limitations, rights, exact reproducible fetch/transform/verify. Official API may require a key; never embed or commit credentials. If blocked, provide exact owner-download batch request and a tested offline transformation, not fictitious values.

Publish typed immutable county marginals APIs for E2, separate from synthetic ballots. Native CI validates all 95, proper universe sums, unknown/sentinel handling, no duplicate IDs, no source drift, no assumed demographic overlaps. Preserve historical Tennessee SOS 2024 blocked source getter and its source-audit workflows; Issue #20 remains open. Only owned files; open PR to integration, never self-merge.
