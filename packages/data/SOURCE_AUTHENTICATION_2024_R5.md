# Tennessee 2024 presidential original-source authentication — Round Five

**Result:** PROVEN DATA RECONCILIATION, NO PUBLIC HISTORICAL RELEASE. The canonical data API remains unavailable. Source and rights decisions require separate conductor/owner approval under Issues #20 and #5.

## Evidence ledger — keep these distinct

1. **Owner-provided 28-page SOS by-county PDF**: SHA-256 `bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f`, 150,933 bytes. 95 county rows with seven named tickets. File says November 5, 2024 election and December 2, 2024 print date.
2. **Owner-provided 225-page SOS by-precinct PDF**: SHA-256 `5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b`, 1,626,347 bytes. 1,862 precinct rows sum to all 95 county rows and the seven-ticket total `3,063,942`. Both original-format files have Microsoft Access producer metadata; metadata is *not* a cryptographic publisher signature.
3. **Independent SOS publisher-hosted, search-indexed text from the by-office PDF**: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf . The presidential section explicitly lists seven presidential tickets with exact ordered counts `[1966865,1056265,5865,3457,988,21535,8967]`, and `Total Votes 3,063,942`. It prints December 2, 2024. Direct binary retrieval in this environment was HTTP 403, so there is **no verified by-office PDF SHA-256**. Search-indexed publisher text can corroborate reported published content, but cannot prove the binary identity of the two owner-uploaded PDFs; search indexes may be stale and are not SOS file signatures.
4. **Official all-by-precinct spreadsheet**: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx . Not supplied; direct binary retrieval yielded HTTP 403. No knowledge of its worksheet structure, presidential write-ins, undervotes or ballots-cast columns is claimed. The optional read-only inventory tool does not authenticate or ingest votes.

The two published report PDFs independently reconcile 95 county GEOIDs and 1,862 precinct records, but **none of these three observations establishes that copies are byte-identical to a fresh official SOS server download**. A SHA of an owner's uploaded file proves only the identity of the supplied bytes over time. Conductor can set a bounded alternate content-authentication policy only after written decision documenting exact original SOS publication evidence, version, full 95-county comparisons and what remains unproven; Engineer #3 has NOT relaxed the mandatory byte-identity gate.

## What is and is not counted

**Known:** seven named presidential tickets: Trump/Vance 1,966,865; Harris/Walz 1,056,265; Bowman/Bowman 5,865; De la Cruz/Garcia 3,457; Fruit/Richter 988; Kennedy/Shanahan 21,535; Stein/Kpadenou 8,967. Sum: 3,063,942. These are votes for the **seven printed tickets**, not an estimate of all ballots cast or eligible voters.

**Not observed from the cited presidential sections:** write-ins by county, statewide write-ins, undervotes/overvotes, total ballots cast or eligible voters. A secondary commercial election atlas publishes additional statewide categories but those values are NOT independently authenticated by these SOS reports and are not imported, backallocated, or turned into zeros. Do not infer turnout from a different race's denominator. No precinct spreadsheet fields can be described before original bytes are available.

## Factual-data reuse analysis for conductor and owner

- Under U.S. copyright law, actual vote counts, candidate names and county geographic names are **facts**. `17 U.S.C. §102(b)` and *Feist Publications, Inc. v. Rural Telephone Service Co.*, 499 U.S. 340 (1991), distinguish facts from a report's potentially copyrightable original selection, layout, wording and design. Independently normalized numeric election results and county names have a strong factual noncopyright rationale.
- `17 U.S.C. §105` specifically covers U.S. **federal** government works; Tennessee state-created PDFs are not automatically federal public-domain works. Do not rehost the original PDF, spreadsheet, emblems, distinctive graphical report layout, or publisher text without separate permission/terms analysis.
- Copyright status of individual facts does not eliminate the need to evaluate access/website terms, contractual restrictions, redistribution clauses or publisher identification/attribution. **No live Tennessee SOS terms-specific permission determination has been substantiated**. No conclusion that scraping behind HTTP 403 is permitted. Browser-download access must not circumvent authorization or security controls.
- Proposed scope for approval: publish **only a newly generated 95-county machine-readable table of seven SOS reported ticket votes with 2020 Census GEOIDs**, cite publisher/original URL and report date, conspicuously label missing ballot categories, exclude original PDF/XLSX binaries. Avoid any suggestion of SOS endorsement or of a complete voter-turnout model.
- Required decisions before release: (a) source-binary identity OR conductor-accepted independently documented content-authentication alternative; (b) signed/dated rights and access-terms determination; (c) written seven-ticket-only semantics approval; (d) exact 95-county, seven-candidate reproducible hash/validation; (e) review of UI and downstream denominator semantics. The current writer and getter remain fail-closed.

## Next acquisition and validation

Obtain the **original bytes without re-saving** from the Secretary of State results page in browser, record the full official URL, download date, original filename, response details if visible (but no cookies or HAR), compare `sha256sum` of county and precinct copies to their pinned values, and preserve the independently fetched office PDF and spreadsheet as separate originals. An upload from the owner permits integrity checks and report reconciliation; it still does not prove independent publisher byte identity without additional evidence.

```sh
node --test scripts/tn-2024-office-validation.test.mjs scripts/tn-2024-release-gate.test.mjs
node scripts/audit-tennessee-2024-office.mjs /secure/path/20241105GeneralbyOffice.pdf
python3 scripts/tn-2024-xlsx-inventory.py /secure/path/20241105AllbyPrecinct.xlsx
node scripts/generate-tennessee-2024.mjs --check
```

The by-office auditor verifies exact seven ticket identities, reported counts and the office `Total Votes`; it reports file hash as **owner-supplied, not government authenticated**. The spreadsheet inventory validates that a file is a bounded XLSX archive and inventories sheet names/label string occurrences; it does not parse rows into presidential observations, verify workbook signatures, or pretend that absent write-in labels prove zeros. Native CI checks these parsers with synthetic inputs and enforces the gate. Keep the original documents out of the public repository.

**Independently reviewed legal source links:** https://www.law.cornell.edu/uscode/text/17/102 ; https://www.law.cornell.edu/supremecourt/text/499/340 ; https://www.law.cornell.edu/uscode/text/17/105 . Conductor must evaluate official Tennessee SOS website terms directly, not infer site permission from public availability.
