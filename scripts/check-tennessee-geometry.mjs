#!/usr/bin/env node
/** CI gate: source, geometry/vote join and checksums; no network required. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTennesseeGeometry } from './tn-geometry-lib.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, 'packages/data/fixtures/', p));
const references = JSON.parse(read('tennessee-counties-2020.json'));
const votes = JSON.parse(read('tennessee-synthetic-v1.json'));
const provenance = JSON.parse(read('tennessee-geometry-2020.provenance.json'));
const bytes = read('tennessee-counties-real-2020.geo.json');
const digest = createHash('sha256').update(bytes).digest('hex');
const assert = (pass, message) => { if (!pass) throw new Error('Real Tennessee geometry CI gate: ' + message); };
assert(provenance.schemaVersion === 1 && provenance.geographyVintage === '2020', 'wrong geometry vintage');
assert(provenance.sourcePublisher === 'U.S. Census Bureau' && provenance.originalSourceURL.startsWith('https://www2.census.gov/'), 'unverified publisher/source');
assert(provenance.sourceMirror?.gitBlobSha1 === '96bec1fe4d0569557b54ac5d77e7995068d76e48', 'unpinned source mirror');
assert(provenance.output.sha256 === digest && provenance.output.bytes === bytes.length, 'output SHA-256/byte mismatch');
assert(provenance.output.bytes <= 2_000_000, 'geometry exceeds 2MB uncompressed size budget');
const geometry = JSON.parse(bytes);
const stats = validateTennesseeGeometry(geometry, references);
assert(JSON.stringify(stats.bbox) === JSON.stringify(provenance.output.bbox), 'bbox provenance mismatch');
assert(stats.vertices === provenance.output.vertices && stats.multipolygons === provenance.output.multipolygons
  && stats.holes === provenance.output.holes, 'geometry statistics changed');
assert(votes.election.geographyVintage === '2020' && votes.election.dataStatus === 'synthetic', 'vote dataset vintage/status mismatch');
assert(votes.units.length === 95 && votes.units.every((row, i) => row.geoId === geometry.features[i].properties.geoId), 'geometry does not exactly join synthetic county votes');
assert(!geometry.features.some(f => 'votes' in f.properties || 'eligibleVoters' in f.properties), 'real geometry contains synthetic election observations');
console.log(JSON.stringify({ status: 'PASS', counties: stats.count, vertices: stats.vertices, multipolygons: stats.multipolygons,
  holes: stats.holes, bbox: stats.bbox, bytes: bytes.length, sha256: digest, geometry: 'Census 2020, simplified',
  votes: 'fictional', geometrySource: provenance.originalSourceURL }, null, 2));
