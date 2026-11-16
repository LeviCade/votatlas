# VOTATLAS — ENGINEER #3, ROUND FOUR: AUTHENTICATE THE 2024 TENNESSEE SOS DATA

Standalone assignment for a new ChatGPT engineer chat. Everything required is in the public repository.

Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r4-e3-official-source
PR target: integration
Starting SHA: conductor-pinned exact Round Four SHA in GitHub Issue #26.
Issues: #26 engineering, #20 historical official-data release gate still OPEN.
Exclusive ownership: packages/data/**, scripts/**, .github/workflows/**. DO NOT edit root, shared contracts, web, map, sim-core or documentation outside owned paths.

FIRST: Read docs/CONDUCTOR_HANDOFF.md, full Issue #26 and #20, packages/data/README.md, scripts/generate-tennessee-2024.mjs, scripts/tn-2024-sos-lib.mjs, current blocked fixture and its provenance manifest.

CONTEXT: Rounds 1-3 merged. React/MapLibre displays 95 actual Tennessee county boundaries, synthetic votes and custom candidates. Scenario v2 saving, Undo/Reset, leader-color flipping and browser tests passed. R3 PR #23 delivered a tested source ingestion pipeline but did NOT publish official 2024 county votes. The original Tennessee SOS County PDF was HTTP 403 on GitHub Actions; original source SHA is unknown, publication status blocked.

MISSION: Get verifiable authentic Tennessee Secretary of State NOVEMBER 5, 2024 presidential results and produce source-authenticated 95-county fixture only after every gate passes.

Primary source options:
- Official by-county report: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyCounty.pdf
- Official by-precinct report: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyPrecinct.pdf (county subtotal rows across 225 pages; build new reliable parser if needed)
- Official all-by-precinct XLSX: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx
- A PDF supplied by the repository owner from Safari; verify original bytes, document source path, SHA256 and publication details. Do not redistribute raw PDF if rights unresolved.
- Authenticated archival copy of original SOS PDF, but never silently replace original with third-party normalized election estimates.

Acceptance:
1. Authenticate source bytes and source provenance, derive all 95 source county rows for exactly seven printed presidential tickets with correct candidate identity. Statewide seven-ticket sum must match independent SOS reported 3,063,942.
2. Distinguish seven-ticket votes, write-ins, undervotes and full ballots cast. Do not represent unknown county write-ins as observed zeros. No fabricated numbers or synthetic eligible-voter figures.
3. Record source checksum, version, release/certification date, source host (original vs archive), county parsing details, manifest checksum, GEOID mapping and rights. Tennessee state records are not automatically federal public domain under 17 USC 105.
4. Verify exact sums and all geography joins. Negative regression tests for altered source, missing/duplicate county, candidate mislabeling, column reordering, write-in misunderstanding and cross-county swaps.
5. Keep source status BLOCKED and existing throwing official fixture API until the above gates and conductor rights signoff pass. Do not expose unverified historical data in the user interface.
6. Run native CI plus source reproduction tests, coordinate exported API with Engineer #1 but stay within ownership.

Deliver reviewed PR to integration and exact source audit evidence. If access remains 403, produce a specific acquisition checklist and a tested alternative authentic-source parser; do not fake a certified fixture. DO NOT MERGE YOUR OWN PR.
