import { OFFICIAL_STATEWIDE, sha256 } from './tn-2024-sos-lib.mjs';
import { TICKET_HEADERS } from './tn-2024-sos-precinct-lib.mjs';

function requireThat(ok, message) { if (!ok) throw new Error('TN 2024 by-office: ' + message); }
function vote(token) {
  requireThat(/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(token),'invalid vote token '+token);
  const n=Number(token.replaceAll(',',''));
  requireThat(Number.isSafeInteger(n),'unsafe integer');
  return n;
}
/** Verifies only the presidential section of the Tennessee SOS by-office report.
 * Accepts PDF layout text with count on preceding or same line. This is not a
 * substitute for original-byte acquisition or proof of all ballots cast. */
export function parsePresidentialOffice(text, expected=OFFICIAL_STATEWIDE) {
  requireThat(typeof text==='string' && text.length>100,'empty extraction');
  requireThat(/November\s+5,\s+2024/.test(text),'election date mismatch');
  requireThat(/State of Tennessee\s*-\s*Totals/.test(text),'publisher report heading missing');
  const heading='President and Vice President of the United States';
  const start=text.indexOf(heading);
  const end=text.indexOf('United States Senate',start+heading.length);
  requireThat(start>=0 && end>start,'presidential office section incomplete');
  const lines=text.slice(start+heading.length,end).split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const found=[];
  let total=null;
  for (let i=0;i<lines.length;i++) {
    let row=/^(?:(\d[\d,]*) )?([1-7])\.? (Electors for .+)$/.exec(lines[i]);
    if (row) {
      const order=Number(row[2])-1;
      requireThat(order===found.length,'candidate row reordered, duplicated, or omitted');
      requireThat(row[3]===TICKET_HEADERS[order],'candidate identity mismatch at '+(order+1));
      const number=row[1]??lines[i-1];
      requireThat(number!==undefined,'candidate count missing');
      found.push(vote(number));
      continue;
    }
    const same=/^Total Votes (\d[\d,]*)$/.exec(lines[i]);
    if(same) { requireThat(total===null,'duplicate total'); total=vote(same[1]); continue; }
    if(lines[i]==='Total Votes') {
      requireThat(total===null && i+1<lines.length,'missing/duplicate total');
      total=vote(lines[++i]);
    }
  }
  requireThat(found.length===7,'exactly seven named tickets required');
  requireThat(total!==null,'printed office total missing');
  requireThat(found.reduce((a,b)=>a+b,0)===total,'office total fails conservation');
  requireThat(Array.isArray(expected) && expected.length===7,'bad reference vector');
  requireThat(found.every((n,i)=>n===expected[i]),'office results differ from independent county/precinct audit');
  requireThat(total===3063942,'wrong seven-ticket denominator');
  return {ticketVotes:found,printedTicketTotal:total,
    universe:'seven named presidential tickets only; write-ins, undervotes and ballots cast not reported'};
}
export function inspectOfficeBytes(bytes, text, expected=OFFICIAL_STATEWIDE) {
  requireThat(Buffer.isBuffer(bytes) && bytes.subarray(0,5).toString()==='%PDF-','original by-office PDF bytes required');
  return {sha256:sha256(bytes),bytes:bytes.length, ...parsePresidentialOffice(text,expected)};
}
