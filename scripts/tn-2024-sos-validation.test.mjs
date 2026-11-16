import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCountyReport,transformCountyReport,validateRefs,sha256,verifySourceChecksum,OFFICIAL_STATEWIDE} from './tn-2024-sos-lib.mjs';
const refs=JSON.parse(readFileSync(new URL('../packages/data/fixtures/tennessee-counties-2020.json',import.meta.url)));
const names=refs.map(x=>x.name.slice(0,-7)).sort((a,b)=>a.localeCompare(b,'en'));
const values=[2,4,1,0,0,1,1],totals=values.map(n=>n*95);
const sample=()=>['State of Tennessee November 5, 2024',
 'President and Vice President of the United States',
 'Electors for Donald J. Trump / Electors for Kamala D. Harris',
 ...names.map(n=>n+' '+values.join(' ')),
 'STATE TOTALS '+totals.join(' '),'December 2, 2024','United States Senate'].join('\n');
test('95 exact county IDs, seven candidate tickets, no fabricated eligible voters',()=>{
 const p=parseCountyReport(sample(),refs,totals), d=transformCountyReport(p);
 assert.equal(p.rows.length,95);assert.equal(new Set(p.rows.map(r=>r.geoId)).size,95);
 assert.equal(d.units[0].geoId,'47001');assert.equal(d.units.at(-1).geoId,'47189');
 assert.equal(d.election.candidates.length,7);
 assert.ok(d.units.every(r=>r.eligibleVoters===null && r.otherBallots===0));
});
test('synthetic sample cannot pass official by-office statewide totals',()=>{
 assert.throws(()=>parseCountyReport(sample(),refs),/independently published/);
 assert.equal(OFFICIAL_STATEWIDE.reduce((a,b)=>a+b,0),3063942);
});
test('swapped county source rows rejected even with unchanged sums',()=>{
 const a=sample().split('\n');[a[3],a[4]]=[a[4],a[3]];
 assert.throws(()=>parseCountyReport(a.join('\n'),refs,totals),/reordered/);
});
test('missing county rejected instead of a fabricated zero',()=>{
 assert.throws(()=>parseCountyReport(sample().replace(/^Davidson .*$/m,''),refs,totals),/required 95/);
});
test('duplicate county and GEOID rejected',()=>{
 const a=sample().replace(/^Anderson .*$/m,s=>s+'\n'+s);
 assert.throws(()=>parseCountyReport(a,refs,totals),/duplicate county/);
 const b=structuredClone(refs);b[1].geoId='47001';
 assert.throws(()=>validateRefs(b),/reordered county GEOID/);
});
test('extra candidate column and missing statewide total fail closed',()=>{
 assert.throws(()=>parseCountyReport(sample().replace(/^Anderson .*$/m,s=>s+' 5'),refs,totals),/required 95/);
 assert.throws(()=>parseCountyReport(sample().replace('STATE TOTALS','NOT TOTALS'),refs,totals),/STATE TOTALS|unrecognized county label/);
});
test('source bytes SHA tampering rejected',()=>{
 const original=Buffer.from('%PDF-1.7\noriginal source');
 const digest=sha256(original);
 assert.equal(verifySourceChecksum(original,digest),digest);
 assert.throws(()=>verifySourceChecksum(Buffer.from('%PDF-1.7\nmodified'),digest),/source bytes changed/);
});
test('write-ins excluded, not silently assigned to fabricated county counts',()=>{
 const d=transformCountyReport(parseCountyReport(sample(),refs,totals));
 assert.match(d.election.title,/write-ins excluded/);
 assert.equal(Object.values(d.units[0].votes).reduce((a,b)=>a+b,0),9);
});
