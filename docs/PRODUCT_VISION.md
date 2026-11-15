# Votatlas — Product Vision

**Mission:** a map-first election laboratory supporting any number of candidates and geographic scopes, with historically grounded and explicitly fictional scenarios.

## Experience
- Panoramic, high-performance election map; top candidate scoreboard; compact map toolbar; right contextual editing dock.
- Historical mode: authoritative published baseline results with dates, jurisdictions, candidates, source versions and corrections.
- Sandbox mode: create an election, set candidate names/parties/colors, choose governing rules, select geography, edit candidate support/turnout, and save/replay the scenario.
- Geographic scopes: nation, state, county, versioned congressional district, and supported precinct. A selection determines where an operation applies, not which algorithm exists.
- Candidate adjustments: exact share, percentage-point transfer, turnout scale and eventually demographic preference. All operations specify redistribution and denominator semantics.
- Built-in and user-defined demographics, with estimation and overlap disclosures. Synthetic cohorts are allowed and clearly marked.
- View modes: results first, then swing, trend, comparison and data provenance.
- Export and import scenario JSON; eventual screenshot/CSV/share links.

## First playable vertical slice (v0.1)
A deterministic synthetic dataset with Tennessee's 95 county IDs and 3 fictional candidates; map click-to-select, county support transfer, live county/state scoreboard, exact reset, and JSON export/import. Real-world data is not necessary for this stage.

## Non-goals in v0.1
No live forecasts, campaign targeting, full precinct coverage, custom state boundaries, all historical presidential elections, real demographic intersections or voter registration.

## Product ethics
Never present simulated preferences as an observation of actual voters. Make uncertainty and data provenance obvious. Avoid candidate ranking or political advocacy in product copy.

## Originality
ElectIndex is inspiration for map-first interactions; implement independent source code, source-licensed geography and properly attributed data. Do not reproduce proprietary assets or bulk data without explicit rights.
