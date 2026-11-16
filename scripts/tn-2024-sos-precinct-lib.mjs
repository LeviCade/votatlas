import { sha256, serialize, validateRefs } from './tn-2024-sos-lib.mjs';

export const TICKET_HEADERS = Object.freeze([
  'Electors for Donald J. Trump for President and JD Vance for Vice President - Republican',
  'Electors for Kamala D. Harris for President and Tim Walz for Vice President - Democratic',
  'Electors for Jay J Bowman for President and De D Bowman for Vice President - Independent',
  'Electors for Claudia De la Cruz for President and Karina Garcia for Vice President - Independent',
  'Electors for Rachele Fruit for President and Dennis Richter for Vice President - Independent',
  'Electors for Robert F. Kennedy Jr. for President and Nicole Shanahan for Vice President - Independent',
  'Electors for Jill Stein for President and Samson LeBeau Kpadenou for Vice President - Independent'
]);
const demand = (condition, message) => { if (!condition) throw new Error('TN SOS precinct audit: ' + message); };
const numbers = value => {
  const items = value.trim().split(/\s+/);
  demand(items.length === 7, 'expected seven integer columns');
  return items.map(item => {
    demand(/^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)$/.test(item), 'invalid integer: ' + item);
    const n = Number(item.replaceAll(',', ''));
    demand(Number.isSafeInteger(n) && n >= 0, 'invalid vote count');
    return n;
  });
};
export function verifySevenTicketHeader(text) {
  demand(typeof text === 'string', 'missing source text');
  const preamble = text.split(/\bAnderson(?: County)?\b/)[0];
  demand(/November\s+5,\s+2024/.test(preamble), 'incorrect election date');
  demand(/President and Vice President of the United States/.test(preamble), 'incorrect office');
  const actual = [...preamble.matchAll(/^\s*([1-7])\.\s+(Electors for .*?)\s*$/gm)];
  demand(actual.length === 7, 'expected seven ordered presidential ticket labels');
  for (let i = 0; i < 7; i++) {
    demand(Number(actual[i][1]) === i + 1 && actual[i][2].replace(/\s+/g, ' ').trim() === TICKET_HEADERS[i], 'presidential ticket mislabeling or column permutation at ' + (i + 1));
  }
  return true;
}
export function parsePrecinctReport(text, refs) {
  validateRefs(refs);
  demand(typeof text === 'string' && text.length > 100, 'missing PDF text');
  verifySevenTicketHeader(text);
  const presidential = text.split('United States Senate')[0];
  demand(/December\s+2,\s+2024/.test(presidential), 'missing report print date');
  const valid = new Map(refs.map(ref => [ref.name.slice(0, -7), ref.geoId]));
  const seen = new Map(), sourceOrder = [];
  let active = null, precinctCount = 0, counts = Array(7).fill(0);
  for (const line of presidential.split(/\r?\n/)) {
    const heading = /^\s*([A-Za-z]+(?: [A-Za-z]+)?) County\s*$/.exec(line);
    if (heading) {
      const name = heading[1];
      demand(valid.has(name), 'unrecognized county heading ' + name);
      demand(!seen.has(name), 'repeated county after subtotal: ' + name);
      demand(active === null || active === name, 'missing county subtotal for ' + active);
      if (active === null) { active = name; precinctCount = 0; counts = Array(7).fill(0); }
      continue;
    }
    const subtotal = /^\s*County Totals:\s*((?:[\d,]+\s+){6}[\d,]+)\s*$/.exec(line);
    if (subtotal) {
      demand(active !== null, 'county subtotal without heading');
      const declared = numbers(subtotal[1]);
      demand(precinctCount > 0, 'county with no precinct records: ' + active);
      demand(declared.every((v, i) => v === counts[i]), 'precinct votes do not sum to county subtotal: ' + active);
      seen.set(active, { geoId: valid.get(active), county: active, counts: declared, precinctCount });
      sourceOrder.push(active);
      active = null;
      continue;
    }
    const precinct = /^\s*(\S(?:.*?\S)?)\s{2,}((?:[\d,]+\s+){6}[\d,]+)\s*$/.exec(line);
    if (precinct && active !== null) {
      const values = numbers(precinct[2]);
      values.forEach((v, i) => { counts[i] += v; });
      precinctCount++;
    }
  }
  demand(active === null, 'final county subtotal missing: ' + active);
  demand(seen.size === 95, 'expected 95 complete precinct counties, found ' + seen.size);
  const expected = [...valid.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  demand(sourceOrder.every((name, i) => name === expected[i]), 'precinct county rows missing or reordered');
  const rows = refs.map(ref => seen.get(ref.name.slice(0, -7)));
  demand(rows.every(Boolean), 'incomplete Census geography join');
  const totals = Array(7).fill(0);
  rows.forEach(row => row.counts.forEach((value, index) => { totals[index] += value; }));
  return { rows, totals, precinctCount: rows.reduce((sum, row) => sum + row.precinctCount, 0) };
}
export function reconcileCountyAndPrecinct(county, precinct) {
  demand(county?.rows?.length === 95 && precinct?.rows?.length === 95, 'incomplete report pair');
  for (let i = 0; i < 95; i++) {
    const c = county.rows[i], p = precinct.rows[i];
    demand(c.geoId === p.geoId && c.county === p.county, 'county-to-GEOID or geographic order mismatch at index ' + i);
    demand(c.counts.length === 7 && p.counts.length === 7 && c.counts.every((n, j) => n === p.counts[j]), 'county / precinct source disagreement: ' + c.county);
  }
  demand(county.totals.every((n, i) => n === precinct.totals[i]), 'source statewide totals disagree');
  return { matchedCounties: 95, precinctCount: precinct.precinctCount,
    rowSha256: sha256(Buffer.from(serialize(county.rows))), totals: [...county.totals],
    sevenTicketVotes: county.sevenTicketVotes };
}
