import { createHash } from 'node:crypto';

export const SOURCE_URL = 'https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyCounty.pdf';
export const OFFICE_URL = 'https://sos-prod.tnsosgovfiles.com/s3fs-public/document/20241105GeneralbyOffice.pdf';
export const ELECTION_ID = 'tn-2024-president-sos-seven-ticket-v1';
export const CANDIDATES = Object.freeze([
  {id:'tn24-trump-vance',name:'Donald J. Trump / JD Vance',partyLabel:'Republican',color:'#BC4751',ballotOrder:0},
  {id:'tn24-harris-walz',name:'Kamala D. Harris / Tim Walz',partyLabel:'Democratic',color:'#4479C3',ballotOrder:1},
  {id:'tn24-bowman-bowman',name:'Jay J Bowman / De D Bowman',partyLabel:'Independent',color:'#896C95',ballotOrder:2},
  {id:'tn24-delacruz-garcia',name:'Claudia De la Cruz / Karina Garcia',partyLabel:'Independent',color:'#B8895B',ballotOrder:3},
  {id:'tn24-fruit-richter',name:'Rachele Fruit / Dennis Richter',partyLabel:'Independent',color:'#988B53',ballotOrder:4},
  {id:'tn24-kennedy-shanahan',name:'Robert F. Kennedy Jr. / Nicole Shanahan',partyLabel:'Independent',color:'#4E9A86',ballotOrder:5},
  {id:'tn24-stein-kpadenou',name:'Jill Stein / Samson LeBeau Kpadenou',partyLabel:'Independent',color:'#568D59',ballotOrder:6}
]);
export const OFFICIAL_STATEWIDE = Object.freeze([1966865,1056265,5865,3457,988,21535,8967]);
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function requireThat(ok, message) { if (!ok) throw new Error('TN 2024 SOS: ' + message); }
function num(s) {
  requireThat(/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(s), 'invalid integer token: ' + s);
  const n=Number(s.replaceAll(',',''));
  requireThat(Number.isSafeInteger(n) && n >= 0, 'unsafe/negative vote: ' + s);
  return n;
}
export function verifySourceChecksum(bytes, digest) {
  requireThat(/^[a-f0-9]{64}$/.test(digest), 'invalid pinned SHA256');
  requireThat(sha256(bytes)===digest,'source bytes changed relative to pinned official SHA256');
  return digest;
}
export function validateRefs(refs) {
  requireThat(Array.isArray(refs) && refs.length===95,'expected exactly 95 Census references');
  const seen=new Set();
  for(let i=0;i<95;i++) {
    const id='47'+String(i*2+1).padStart(3,'0');
    requireThat(refs[i]?.geoId===id,'missing, repeated or reordered county GEOID at '+i);
    requireThat(typeof refs[i].name==='string' && refs[i].name.endsWith(' County'),'invalid Census name at '+i);
    requireThat(!seen.has(refs[i].name),'duplicate county name');
    seen.add(refs[i].name);
  }
  return refs;
}
/** Input is actual pdftotext -layout text from original SOS PDF pages one and two.
 * No attempt to infer missing entries or convert them to zero. */
export function parseCountyReport(text, refs, expectedTotals=OFFICIAL_STATEWIDE) {
  validateRefs(refs);
  requireThat(typeof text==='string' && text.length>100,'empty or truncated PDF extraction');
  requireThat(/November\s+5,\s+2024/.test(text),'wrong election date');
  requireThat(/December\s+2,\s+2024/.test(text),'SOS report date missing');
  requireThat(/President and Vice President of the United States/.test(text),'presidential heading missing');
  requireThat(/Donald J\. Trump/.test(text) && /Kamala D\. Harris/.test(text),'candidate header missing');
  const officialNames=new Map(refs.map(r=>[r.name.slice(0,-7),r.geoId]));
  const sourceRows=[];
  const observed=new Map();
  let sourceStateTotals;
  for (const raw of text.split(/United States Senate/)[0].split(/\r?\n/)) {
    const line=raw.replace(/\s+/g,' ').trim();
    if (/^STATE TOTALS\b/i.test(line)) {
      requireThat(!sourceStateTotals,'duplicate source statewide row');
      const parts=line.replace(/^STATE TOTALS\b/i,'').trim().split(' ');
      requireThat(parts.length===7,'statewide row is missing candidate columns');
      sourceStateTotals=parts.map(num);
      continue;
    }
    const match=/^([A-Za-z]+(?: [A-Za-z]+)?) ((?:[\d,]+(?: [\d,]+){6}))$/.exec(line);
    if(!match) continue;
    const county=match[1];
    requireThat(officialNames.has(county),'unrecognized county label '+county);
    requireThat(!observed.has(county),'duplicate county row '+county);
    observed.set(county, match[2].split(' ').map(num));
    sourceRows.push(county);
  }
  requireThat(sourceStateTotals?.length===7,'original SOS STATE TOTALS line absent');
  requireThat(sourceRows.length===95,'required 95 observed county rows, found '+sourceRows.length);
  const alphabetical=[...officialNames.keys()].sort((a,b)=>a.localeCompare(b,'en'));
  requireThat(sourceRows.every((name,i)=>name===alphabetical[i]),'source counties reordered / possibly swapped');
  const totals=Array(7).fill(0);
  const rows=refs.map(ref=>{
    const county=ref.name.slice(0,-7);
    const counts=observed.get(county);
    requireThat(counts?.length===7,'missing candidate results for '+county);
    for(let i=0;i<7;i++) totals[i]+=counts[i];
    return {geoId:ref.geoId,county,counts};
  });
  requireThat(expectedTotals.length===7,'expected statewide reference must have seven columns');
  for(let i=0;i<7;i++) {
    requireThat(totals[i]===sourceStateTotals[i],'county total differs from original PDF STATE TOTALS: candidate '+i);
    requireThat(totals[i]===expectedTotals[i],'county total differs from independently published SOS by-office results: candidate '+i);
  }
  if(expectedTotals===OFFICIAL_STATEWIDE) requireThat(totals.reduce((a,b)=>a+b,0)===3063942,'incorrect seven-ticket denominator');
  return {rows,totals,sevenTicketVotes:totals.reduce((a,b)=>a+b,0)};
}
/** Limited official SEVEN PRINTED TICKETS only. Other ballots are NOT accounted for. */
export function transformCountyReport(parsed) {
  requireThat(parsed.rows?.length===95,'unreconciled source must not be transformed');
  return {election:{
    id:ELECTION_ID,title:'2024 Tennessee President — SOS seven printed tickets (write-ins excluded)',
    office:'President and Vice President of the United States',year:2024,
    geographyVintage:'2020',dataStatus:'official',
    candidates:CANDIDATES.map(c=>({...c}))
  },units:parsed.rows.map(row=>({
    geoId:row.geoId,stateId:'47',eligibleVoters:null,
    votes:Object.fromEntries(CANDIDATES.map((c,i)=>[c.id,row.counts[i]])),
    otherBallots:0
  }))};
}
export function serialize(value) {return JSON.stringify(value,null,2)+'\n';}
