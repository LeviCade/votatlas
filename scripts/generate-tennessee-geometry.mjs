#!/usr/bin/env node
/** Explicit opt-in 2020 Census mirror regeneration; --check validates committed output offline. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRealTennesseeGeometry, validateTennesseeGeometry } from './tn-geometry-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const refsFile = resolve(root, 'packages/data/fixtures/tennessee-counties-2020.json');
const outFile = resolve(root, 'packages/data/fixtures/tennessee-counties-real-2020.geo.json');
const provenanceFile = resolve(root, 'packages/data/fixtures/tennessee-geometry-2020.provenance.json');
const provenance = JSON.parse(readFileSync(provenanceFile, 'utf8'));
const refs = JSON.parse(readFileSync(refsFile, 'utf8'));
const args = process.argv.slice(2);
if (args.length !== 1 || !['--write', '--check', '--check-source'].includes(args[0])) {
  console.error('Usage: node scripts/generate-tennessee-geometry.mjs --check|--check-source|--write');
  process.exit(2);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function inspectCommitted() {
  const data = readFileSync(outFile);
  const digest = sha(data);
  if (digest !== provenance.output.sha256) throw new Error('Committed geometry SHA-256 does not match geometry provenance manifest');
  if (data.length !== provenance.output.bytes) throw new Error('Committed geometry byte count does not match manifest');
  const result = validateTennesseeGeometry(JSON.parse(data.toString('utf8')), refs);
  if (JSON.stringify(result.bbox) !== JSON.stringify(provenance.output.bbox) || result.vertices !== provenance.output.vertices) {
    throw new Error('Committed geometry spatial statistics do not match manifest');
  }
  return { data, result, digest };
}
if (args[0] === '--check') {
  const checked = inspectCommitted();
  console.log(`Verified 2020 Tennessee: ${checked.result.count} authentic county geometries, ${checked.result.vertices} vertices, sha256=${checked.digest}`);
} else {
  const url = provenance.sourceMirror.url;
  if (!url.startsWith('https://raw.githubusercontent.com/Tenjin25/TNRealignmentMap/')) throw new Error('Source host must be exact pinned GitHub mirror');
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Source fetch failed with HTTP ' + response.status);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 12_000_000 || source.length < 100_000) throw new Error('Unexpected Census source size');
  const sourceGitBlob = createHash('sha1').update(Buffer.from('blob ' + source.length + '\0')).update(source).digest('hex');
  if (sourceGitBlob !== provenance.sourceMirror.gitBlobSha1) throw new Error('Pinned upstream mirror content changed');
  const geometry = createRealTennesseeGeometry(JSON.parse(source.toString('utf8')), refs);
  const bytes = Buffer.from(JSON.stringify(geometry) + '\n', 'utf8');
  const digest = sha(bytes), stats = validateTennesseeGeometry(geometry, refs);
  if (args[0] === '--check-source') {
    const committed = inspectCommitted();
    if (!bytes.equals(committed.data)) throw new Error('Checked-in geometry differs from pinned Census mirror regeneration');
    console.log('Pinned Census mirror reproduces committed GeoJSON byte-for-byte: ' + digest);
  } else {
    writeFileSync(outFile, bytes);
    provenance.output = { ...provenance.output, sha256: digest, bytes: bytes.length, bbox: stats.bbox, vertices: stats.vertices,
      multipolygons: stats.multipolygons, holes: stats.holes };
    writeFileSync(provenanceFile, JSON.stringify(provenance, null, 2) + '\n');
    console.log(`Wrote real 95-county geometry: ${bytes.length} bytes, sha256=${digest}`);
  }
}
