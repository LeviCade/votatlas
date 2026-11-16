# VOTATLAS — ENGINEER #3 / ROUND FIVE: 2024 TENNESSEE SOURCE AUTHENTICATION & RELEASE READINESS

Fresh-chat standalone mission. All context lives on GitHub. Repository: https://github.com/LeviCade/votatlas
Branch: feature/v0.1-r5-e3-2024-authentication
PR target: integration
Starting SHA: exact R5 SHA pinned in Issue #32.
Issues: #32 engineering and #20 historical fixture release gate (KEEP OPEN until authenticated/approved).
Exclusive ownership: packages/data/**, scripts/**, .github/workflows/** only.

FIRST: Read docs/CONDUCTOR_HANDOFF.md, R4 PR #28 and source provenance, Issues #20/#32, source audits, rights gates and existing fixture getter.

STATUS: Conductor independently hashed and re-extracted owner-supplied Tennessee Nov 5 2024 original-format reports:
county PDF 28 pages, SHA-256 bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f
precinct PDF 225 pages, SHA-256 5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b
95 counties, 1,862 precinct records, exact seven-ticket statewide vector [1966865,1056265,5865,3457,988,21535,8967], total 3,063,942.
They match each other; direct SOS binary URL still gave GitHub Actions HTTP 403. Source chain is owner-supplied, no independent SOS byte-for-byte comparison yet. Existing historical fixture remains blocked and getter throws. Do not call it official released.

MISSION:
1. If owner has new files, inspect original government-hosted 20241105GeneralbyOffice.pdf and 20241105AllbyPrecinct.xlsx. Extract data only after verifying file source, checksum, MIME and preserved original bytes. Determine whether official write-ins, undervotes, total ballots, congressional-district split or candidate rows exist; DO NOT invent missing fields. Request precise additional files via GitHub Issue #32 whenever necessary.
2. Seek independent primary-source authentication: authenticated binary download when possible; alternatively rigorously document official SOS server HTML/text publication of all 95 county numbers and independent office totals, showing exactly what that proves and does NOT prove about byte identity. Propose a bounded evidence-based alternative source-authentication standard to conductor; do not change existing mandatory authenticated-source gate unilaterally.
3. Reconcile every candidate and GEOID. Preserve universe: 7 named-ticket ballots are NOT full presidential participation, turnout or eligible voters. Prefer an honest seven-ticket-only verified dataset to falsely completed categories.
4. Review TN government factual-results reuse versus PDF expression/redistribution; do not assume all state records federally public domain. Present rights and source provenance for conductor + owner approval, no copied original government PDFs in repo.
5. Once and ONLY once approved authenticity/rights/scope gates are fully satisfied, generate a published 95-county immutable official-source fixture, canonical checksum and data API with reproducible audits/CI; otherwise maintain BLOCKED and deliver strengthened reproducible evidence.
6. Add tests ensuring --write approvalStatus is exactly agreed with runtime getter, no forged 'official' status, negative-source/tamper cases, votes sum, names, provenance and unknown category semantics. Do not alter synthetic fixture/map/source engine.
7. Provide exact pass/fail evidence and PR targeting integration; do NOT merge.

This is source verification, not an election forecasting model.
