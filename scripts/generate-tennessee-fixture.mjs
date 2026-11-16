#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { generateTennesseeFixture, serializeFixture } from './tennessee-fixture-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const countiesPath = resolve(root, 'packages/data/fixtures/tennessee-counties-2020.json');
const fixturePath = resolve(root, 'packages/data/fixtures/tennessee-synthetic-v1.json');
const manifestPath = resolve(root, 'packages/data/fixtures/provenance.json');
const fixtureBytes = serializeFixture(generateTennesseeFixture(JSON.parse(readFileSync(countiesPath, 'utf8'))));
const fixtureHash = createHash('sha256').update(fixtureBytes).digest('hex');
const write = process.argv.includes('--write');
if (!write && process.argv.slice(2).some(arg => arg !== '--check')) {
  console.error('Usage: node scripts/generate-tennessee-fixture.mjs [--check|--write]');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (write) {
  writeFileSync(fixturePath, fixtureBytes);
  manifest.payloadSha256 = fixtureHash;
  writeFileSync(manifestPath, serializeFixture(manifest));
  console.log(`Wrote 95-county fixture and manifest; sha256=${fixtureHash}`);
} else {
  if (readFileSync(fixturePath, 'utf8') !== fixtureBytes) {
    throw new Error('Fixture differs from deterministic generator; run --write and review diff');
  }
  if (manifest.payloadSha256 !== fixtureHash) {
    throw new Error(`Provenance digest mismatch: manifest=${manifest.payloadSha256}, actual=${fixtureHash}`);
  }
  console.log(`Deterministic fixture verified: 95 counties; sha256=${fixtureHash}`);
}
