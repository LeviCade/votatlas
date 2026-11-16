#!/usr/bin/env node
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateTennesseeGeometry } from './tn-geometry-lib.mjs';

const fixture = name => JSON.parse(readFileSync(resolve(import.meta.dirname, '../packages/data/fixtures/', name), 'utf8'));
const references = fixture('tennessee-counties-2020.json');
const real = fixture('tennessee-counties-real-2020.geo.json');
const copy = () => structuredClone(real);

test('all 95 Census 2020 shapes validate and are join-compatible', () => {
  const stats = validateTennesseeGeometry(real, references);
  assert.equal(stats.count, 95);
  assert.equal(stats.vertices, 41363);
  assert.equal(stats.multipolygons, 5);
  assert.deepEqual(stats.bbox, [-90.310455, 34.98302, -81.6469, 36.678255]);
});
test('missing or duplicated GEOIDs fail', () => {
  const missing = copy(); missing.features.pop();
  assert.throws(() => validateTennesseeGeometry(missing, references), /95/);
  const duplicate = copy(); duplicate.features[1] = structuredClone(duplicate.features[0]);
  assert.throws(() => validateTennesseeGeometry(duplicate, references), /duplicate|sorted/);
});
test('unknown GEOID and forged county name fail', () => {
  const unknown = copy(); unknown.features[0].id = '47999'; unknown.features[0].properties.geoId = '47999';
  assert.throws(() => validateTennesseeGeometry(unknown, references), /unrecognized/);
  const name = copy(); name.features[0].properties.name = 'Not Anderson';
  assert.throws(() => validateTennesseeGeometry(name, references), /unrecognized/);
});
test('invalid lon/lat, NaN and nonpolygon shapes fail', () => {
  const bad = copy(); bad.features[0].geometry.coordinates[0][1][0] = -91;
  assert.throws(() => validateTennesseeGeometry(bad, references), /outside Tennessee/);
  const nan = copy(); nan.features[0].geometry.coordinates[0][1][1] = Number.NaN;
  assert.throws(() => validateTennesseeGeometry(nan, references), /non-finite/);
  const shape = copy(); shape.features[0].geometry.type = 'Point';
  assert.throws(() => validateTennesseeGeometry(shape, references), /Polygon/);
});
test('unclosed, degenerate and too-short rings fail', () => {
  const open = copy(); open.features[0].geometry.coordinates[0][0][0] = -86;
  assert.throws(() => validateTennesseeGeometry(open, references), /unclosed/);
  const short = copy(); short.features[0].geometry.coordinates[0] = [[-86,36],[-87,36],[-86,36]];
  assert.throws(() => validateTennesseeGeometry(short, references), /short/);
  const zero = copy(); zero.features[0].geometry.coordinates[0] = [[-86,36],[-86,36],[-86,36],[-86,36]];
  assert.throws(() => validateTennesseeGeometry(zero, references), /degenerate/);
});
test('unsorted county list and wrong feature.id fail', () => {
  const shuffled = copy(); [shuffled.features[0], shuffled.features[1]] = [shuffled.features[1], shuffled.features[0]];
  assert.throws(() => validateTennesseeGeometry(shuffled, references), /sorted/);
  const mismatch = copy(); mismatch.features[0].id = '47003';
  assert.throws(() => validateTennesseeGeometry(mismatch, references), /mismatch/);
});
