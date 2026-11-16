#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCountyReport, sha256, verifySourceChecksum } from './tn-2024-sos-lib.mjs';
import { verifySevenTicketHeader, parsePrecinctReport, reconcileCountyAndPrecinct } from './tn-2024-sos-precinct-lib.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const manifest = readJson('packages/data/fixtures/tennessee-2024-provenance.json');
const refs = readJson('packages/data/fixtures/tennessee-counties-2020.json');
const args = process.argv.slice(2);
const option = name => { const i=args.indexOf(name); return i < 0 ? null : args[i+1]; };
const countyPath = option('--county') ?? option('--source');
const precinctPath = option('--precinct');
if (!countyPath || !precinctPath) throw new Error('Usage: node scripts/audit-tennessee-2024-supplied.mjs --county /path/to/20241105GeneralbyCounty.pdf --precinct /path/to/20241105GeneralbyPrecinct.pdf');
const extract = (file, firstTwoPages=false) => execFileSync('pdftotext',
  [...(firstTwoPages?['-f','1','-l','2']:[]), '-layout', file, '-'],
  {encoding:'utf8', maxBuffer:32*1024*1024});
const countyBytes = readFileSync(countyPath), precinctBytes=readFileSync(precinctPath);
for (const bytes of [countyBytes,precinctBytes]) {
  if (bytes.subarray(0,5).toString() !== '%PDF-') throw new Error('Uploaded file is not PDF');
}
verifySourceChecksum(countyBytes,manifest.sourceSha256);
verifySourceChecksum(precinctBytes,manifest.precinctSourceSha256);
if (manifest.sourceBytes !== countyBytes.length || manifest.precinctSourceBytes !== precinctBytes.length) throw new Error('Pinned source byte length differs');
const countyText = extract(countyPath,true),precinctText=extract(precinctPath);
verifySevenTicketHeader(countyText);
const result = reconcileCountyAndPrecinct(parseCountyReport(countyText, refs), parsePrecinctReport(precinctText, refs));
if (result.rowSha256 !== manifest.countyRowsSha256) throw new Error('County row serialization no longer matches audited original');
if (result.precinctCount !== manifest.precinctCount) throw new Error('Precinct count differs from pinned report');
const summary = {
  result: 'PASSED_RECONCILIATION_NOT_APPROVED_FOR_RELEASE',
  publisherClaim: manifest.publisher, provenanceMethod: manifest.sourceAuthentication.method,
  countySourceSha256:sha256(countyBytes),precinctSourceSha256:sha256(precinctBytes),
  ...result, writeIns: 'not reported by the seven-ticket source columns',
  undervotes: 'not reported', ballotsCast:'not reported', eligibleVoters:null,
  releaseApproved:manifest.releaseApproved, dataStatus:manifest.dataStatus
};
if (manifest.releaseApproved || manifest.dataStatus !== 'blocked') throw new Error('Audited source unexpectedly published before rights approval');
console.log(JSON.stringify(summary,null,2));
