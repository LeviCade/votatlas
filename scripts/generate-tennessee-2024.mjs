#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCountyReport, transformCountyReport, serialize, sha256, verifySourceChecksum } from './tn-2024-sos-lib.mjs';
import { verifySevenTicketHeader, parsePrecinctReport, reconcileCountyAndPrecinct } from './tn-2024-sos-precinct-lib.mjs';
import { assertHistoricalReleaseApproved, historicalReleaseBlockers } from './tn-2024-release-gate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=resolve(root,'packages/data/fixtures/');
const refs=JSON.parse(readFileSync(resolve(base,'tennessee-counties-2020.json'),'utf8'));
const fixturePath=resolve(base,'tennessee-2024-presidential.v1.json');
const manifestPath=resolve(base,'tennessee-2024-provenance.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const args=process.argv.slice(2);
const option=(key)=>{const pos=args.indexOf(key);return pos<0?null:args[pos+1];};
const source=option('--source'), textPath=option('--text'), precinctPath=option('--precinct');
const audit=args.includes('--audit'), write=args.includes('--write'), check=args.includes('--check');
if([audit,write,check].filter(Boolean).length!==1 || (source&&textPath)) throw new Error('Usage: --audit|--write|--check [--source official.pdf]');
if(check && !source && !textPath) {
  const raw=readFileSync(fixturePath);
  const staged=JSON.parse(raw);
  if(!manifest.releaseApproved) {
    if(staged.election?.dataStatus==='official' || manifest.dataStatus!=='blocked' || staged.availability!=='blocked' || staged.units!==undefined || staged.election!==undefined) throw new Error('Unapproved observations marked as official');
    console.log('PASS: historical 2024 fixture remains source/rights BLOCKED');
  } else {
    assertHistoricalReleaseApproved(manifest);
    if(sha256(raw)!==manifest.payloadSha256 || staged.election?.dataStatus!=='official' || staged.units?.length!==95) throw new Error('Approved historical fixture invalid');
    console.log('PASS: approved historical fixture sha256 '+sha256(raw));
  }
  process.exit(0);
}
if(!source && !textPath) throw new Error('Original source PDF required');
let pdfBytes=null, originalDigest=null, reportText;
if(source) {
  pdfBytes=readFileSync(source);
  if(pdfBytes.subarray(0,5).toString()!=='%PDF-') throw new Error('Not a PDF');
  originalDigest=sha256(pdfBytes);
  if(manifest.sourceSha256) verifySourceChecksum(pdfBytes,manifest.sourceSha256);
  reportText=execFileSync('pdftotext',['-layout','-f','1','-l','2',source,'-'],{encoding:'utf8',maxBuffer:10*1024*1024});
} else {
  if(!audit) throw new Error('Text extraction cannot approve release');
  reportText=readFileSync(textPath,'utf8');
}
verifySevenTicketHeader(reportText);
const parsed=parseCountyReport(reportText,refs);
if(precinctPath) {
  if(!source) throw new Error('Precinct verification requires actual county PDF');
  const precinctBytes=readFileSync(precinctPath);
  verifySourceChecksum(precinctBytes,manifest.precinctSourceSha256);
  if(precinctBytes.length!==manifest.precinctSourceBytes) throw new Error('Precinct PDF byte length differs');
  const precinctText=execFileSync('pdftotext',['-layout',precinctPath,'-'],{encoding:'utf8',maxBuffer:32*1024*1024});
  const result=reconcileCountyAndPrecinct(parsed,parsePrecinctReport(precinctText,refs));
  if(result.rowSha256!==manifest.countyRowsSha256 || result.precinctCount!==manifest.precinctCount) throw new Error('County and precinct provenance digest mismatch');
  console.log('SOURCE AUDIT: independent precinct reconciliation PASSED, precincts='+result.precinctCount);
}

const fixture=transformCountyReport(parsed);
const rendered=serialize(fixture);
const proposed={...manifest,sourceSha256:originalDigest,payloadSha256:sha256(rendered),sourceBytes:pdfBytes?.length??null,
  releaseApproved:false,dataStatus:'blocked',sourceStatus:originalDigest?'owner-supplied-PDF-hash-and-county-state-reconciled-upstream-byte-match-pending':'text-extract-only',
  reason:'RIGHTS_AND_WRITEIN_SCOPE_REVIEW_PENDING',
  audit:{counties:parsed.rows.length,sevenTicketVotes:parsed.sevenTicketVotes,byTicket:parsed.totals}};
console.log('SOURCE AUDIT: counties='+parsed.rows.length+' sevenTicketVotes='+parsed.sevenTicketVotes+' totals='+parsed.totals.join(','));
console.log('SOURCE AUDIT: officialPdfSha256='+originalDigest+' officialPdfBytes='+(pdfBytes?.length??0)+' proposedFixtureSha256='+sha256(rendered));
if(audit) {
  console.log('VOTATLAS_TN2024_PROPOSED_FIXTURE_JSON='+JSON.stringify(fixture));
  console.log('VOTATLAS_TN2024_PROPOSED_MANIFEST_JSON='+JSON.stringify(proposed));
} else if(write) {
  if(process.env.VOTATLAS_TN2024_RIGHTS_APPROVED!=='yes' || !originalDigest || !precinctPath ||
     manifest.sourceAuthentication?.officialByteIdentical!==true ||
     manifest.rights?.approvalStatus!=='approved') throw new Error('NO-GO: independently byte-authenticated SOS source, precinct reconciliation and documented conductor rights approval mandatory');
  // Approval is scoped to the pre-recorded manifest, not self-granted by this CLI.
  // A proposed post-write release must pass the same status literal as the runtime getter.
  const approved={...proposed,dataStatus:'official',releaseApproved:true,
    reason:'7 named ticket columns ONLY; no turnout or observed write-in values'};
  assertHistoricalReleaseApproved(approved);
  writeFileSync(fixturePath,rendered);
  writeFileSync(manifestPath,serialize(approved));
  console.log('WROTE approved 95-county official seven-ticket fixture');
} else if(check) {
  if(!manifest.releaseApproved || !originalDigest || originalDigest!==manifest.sourceSha256 ||
     sha256(rendered)!==manifest.payloadSha256 || readFileSync(fixturePath,'utf8')!==rendered) {
    throw new Error('Source/fixture regeneration mismatch or not approved');
  }
  console.log('PASS official source PDF and fixture byte-for-byte regeneration');
}
