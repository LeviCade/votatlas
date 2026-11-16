import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TICKET_HEADERS, verifySevenTicketHeader, parsePrecinctReport, reconcileCountyAndPrecinct } from './tn-2024-sos-precinct-lib.mjs';
const refs = JSON.parse(readFileSync(new URL('../packages/data/fixtures/tennessee-counties-2020.json', import.meta.url)));
const names = refs.map(r => r.name.slice(0,-7)).sort((a,b)=>a.localeCompare(b,'en'));
const header = ['State of Tennessee', 'November 5, 2024', 'State General',
  'President and Vice President of the United States',
  ...TICKET_HEADERS.map((name,i)=>`${i+1}. ${name}`)].join('\n');
const votes = [2,4,1,0,0,1,1];
const sample = () => header + '\n' + names.map(name=>`${name} County\n Precincts:\n  ${name} Local      ${votes.join('     ')}\n County Totals:      ${votes.join('   ')}\n`).join('') + '\nDecember 2, 2024\nUnited States Senate\n';
test('seven specific tickets and 95 counties reconcile all precincts', () => {
  const actual = parsePrecinctReport(sample(),refs);
  assert.equal(actual.rows.length,95);
  assert.equal(actual.precinctCount,95);
  assert.deepEqual(actual.totals,votes.map(x=>x*95));
  const county={rows:actual.rows.map(({geoId,county,counts})=>({geoId,county,counts:[...counts]})),totals:[...actual.totals],sevenTicketVotes:actual.totals.reduce((a,b)=>a+b,0)};
  assert.equal(reconcileCountyAndPrecinct(county,actual).matchedCounties,95);
  county.rows[1].counts[0]++;
  county.rows[0].counts[0]--;
  assert.throws(()=>reconcileCountyAndPrecinct(county,actual),/source disagreement/);
});
test('candidate reordering or relabeling is rejected', () => {
  const bad=sample().replace('1. '+TICKET_HEADERS[0],'1. '+TICKET_HEADERS[1]);
  assert.throws(()=>verifySevenTicketHeader(bad),/mislabeling/);
});
test('tampered precinct counts are rejected even if subtotal unchanged', () => {
  const bad=sample().replace('Anderson Local      2','Anderson Local      3');
  assert.throws(()=>parsePrecinctReport(bad,refs),/do not sum/);
});
test('duplicate and missing county subtotals fail closed', () => {
  const original=sample();
  assert.throws(()=>parsePrecinctReport(original.replace('Anderson County','Arbitrary County'),refs),/unrecognized county/);
  assert.throws(()=>parsePrecinctReport(original.replace('Anderson County\n Precincts:', 'Anderson County\n Precincts:\n County Totals: 2 4 1 0 0 1 1\nAnderson County\n Precincts:'),refs),/no precinct|repeated county/);
  assert.throws(()=>parsePrecinctReport(original.replace('County Totals:      '+votes.join('   '),'COUNTY SUBTOTAL REMOVED'),refs),/missing county subtotal|expected 95|no precinct/);
});
test('missing, duplicated, or rearranged candidate columns are rejected', () => {
  assert.throws(()=>parsePrecinctReport(sample().replace('Anderson Local      2     4','Anderson Local      2     4     99'),refs),/do not sum|no precinct/);
});

test('later-page candidate label drift is rejected', () => {
  const second = header.replace('3. '+TICKET_HEADERS[2],'3. '+TICKET_HEADERS[3]);
  assert.throws(()=>verifySevenTicketHeader(sample().replace('United States Senate','\f'+second+'\nUnited States Senate')),/mislabeling/);
});
