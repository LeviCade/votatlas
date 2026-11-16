import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TICKET_HEADERS} from './tn-2024-sos-precinct-lib.mjs';
import {OFFICIAL_STATEWIDE} from './tn-2024-sos-lib.mjs';
import {parsePresidentialOffice,inspectOfficeBytes} from './tn-2024-office-lib.mjs';
const sample=()=>
  ['November 5, 2024','State of Tennessee - Totals','State General',
   'President and Vice President of the United States',
   ...TICKET_HEADERS.flatMap((s,i)=>[OFFICIAL_STATEWIDE[i].toLocaleString('en-US'),(i+1)+' '+s]),
   'Total Votes','3,063,942','United States Senate'].join('\n');
test('seven exact SOS by-office tickets and printed denominator reconcile',()=>{
 const r=parsePresidentialOffice(sample());
 assert.deepEqual(r.ticketVotes,OFFICIAL_STATEWIDE);
 assert.equal(r.printedTicketTotal,3063942);
 const s=inspectOfficeBytes(Buffer.from('%PDF-1.7\n'),sample());
 assert.match(s.sha256,/^[a-f0-9]{64}$/);
});
test('counts on candidate line also supported',()=>{
 const rows=TICKET_HEADERS.map((s,i)=>OFFICIAL_STATEWIDE[i].toLocaleString('en-US')+' '+(i+1)+' '+s);
 const source=['November 5, 2024','State of Tennessee - Totals','President and Vice President of the United States',
  ...rows,'Total Votes 3,063,942','United States Senate'].join('\n');
 assert.deepEqual(parsePresidentialOffice(source).ticketVotes,OFFICIAL_STATEWIDE);
});
test('identity, ticket order, count, incomplete and full-denominator confusion rejected',()=>{
 assert.throws(()=>parsePresidentialOffice(sample().replace(TICKET_HEADERS[0],TICKET_HEADERS[1])),/identity/);
 assert.throws(()=>parsePresidentialOffice(sample().replace('1 '+TICKET_HEADERS[0],'3 '+TICKET_HEADERS[0])),/reordered/);
 assert.throws(()=>parsePresidentialOffice(sample().replace('1,966,865','1,966,866')),/office results|conservation/);
 assert.throws(()=>parsePresidentialOffice(sample().replace('Total Votes\n3,063,942','Total Ballots\n3,090,161')),/total missing|printed office total/);
 assert.throws(()=>parsePresidentialOffice(sample().replace('United States Senate','')),/incomplete/);
 assert.throws(()=>inspectOfficeBytes(Buffer.from('NOT A PDF'),sample()),/PDF bytes required/);
});
