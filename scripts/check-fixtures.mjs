#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { generateTennesseeFixture, serializeFixture, expectedTennesseeIds } from './tennessee-fixture-lib.mjs';
import { validateElectionDataset, validateProvenanceManifest, createTennesseeSchematicGrid } from '../packages/data/dist/src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => readFileSync(resolve(root, 'packages/data/fixtures', path), 'utf8');
const countySource = JSON.parse(load('tennessee-counties-2020.json'));
const fixtureString = load('tennessee-synthetic-v1.json');
const fixture = JSON.parse(fixtureString);
const manifest = JSON.parse(load('provenance.json'));
if (countySource.length !== 95 || new Set(countySource.map(c => c.geoId)).size !== 95) throw new Error('Source county count or IDs failed');
if (countySource.some((county, i) => county.geoId !== expectedTennesseeIds()[i])) throw new Error('County reference has missing/unexpected FIPS IDs');
if (fixtureString !== serializeFixture(generateTennesseeFixture(countySource))) throw new Error('Fixture differs from deterministic source generator');
const digest = createHash('sha256').update(fixtureString).digest('hex');
if (digest !== manifest.payloadSha256) throw new Error('Fixture sha256 differs from provenance manifest');
validateElectionDataset(fixture, { expectedStateId: '47', requiredGeoIds: expectedTennesseeIds() });
validateProvenanceManifest(manifest, fixture);
const grid = createTennesseeSchematicGrid();
if (grid.features.length !== 95 || grid.coordinateSystem !== 'LOCAL_GRID_NOT_LONGITUDE_LATITUDE') throw new Error('Schematic geometry validation failed');
console.log(`PASS: 95 counties, 3 candidates, vote integrity, provenance, deterministic output SHA-256 ${digest}, schematic geometry`);
