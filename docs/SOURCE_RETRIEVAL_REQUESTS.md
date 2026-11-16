# Votatlas — Direct-source Retrieval Requests

Owner can download original government-hosted files via browser when GitHub Actions or other automated clients receive HTTP 403. Retain exact original bytes; do not reprint PDF to another PDF or copy/paste columns. Do not commit raw originals to the public repository without a distribution-rights decision.

## Tennessee November 5, 2024 — already received
- Original-format state general by-county PDF (28 pages, 150,933 bytes). SHA-256 bd4437b045f592b141bad458d179160c9e7626beb545f7da2dd107305dbb817f
- Original-format state general by-precinct PDF (225 pages, 1,626,347 bytes). SHA-256 5e7c41d6b53378a4c267098d0122f15749a8d538681ec26d3e315e5962a5f99b
- Reconciled 95 counties and 1,862 precinct rows, 7 named presidential tickets totaling 3,063,942 ballots.
- Remaining chain of custody limitation: PDFs were owner supplied, not independently byte-matched to the Secretary of State's original hosted binary. Exact PDF identity has not been asserted.

## Next two highest-priority originals
1. By-office original PDF: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf
2. All-by-precinct original XLSX: https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105AllbyPrecinct.xlsx

When submitting, include the downloaded file and ideally the original direct URL and date downloaded. The source file itself is primary evidence; a screenshot is only supplemental. Do not submit HAR files containing browser session cookies or credentials.

## Source integrity / unknown categories
- County and precinct PDFs contain 7 printed presidential tickets but do not themselves establish per-county write-ins, undervotes or all ballots cast.
- The 7-ticket number must not be labeled full turnout or complete presidential votes. Synthetic eligible voter numbers are not applicable to historical data.
- Repository source release remains blocked under Issue #20 and rights/license release remains open under Issue #5.

## Future multi-state expansion
Conductor will first inventory official publishers and known file names, then issue batches grouped by state/election-year with direct links, desired formats and source priority. No speculative URL patterns or unexplained third-party datasets are acceptable.
