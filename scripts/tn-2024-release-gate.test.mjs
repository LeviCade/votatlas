import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historicalReleaseBlockers,assertHistoricalReleaseApproved} from './tn-2024-release-gate.mjs';
const manifest=JSON.parse(readFileSync(new URL('../packages/data/fixtures/tennessee-2024-provenance.json',import.meta.url)));
test('actual provenance remains hard blocked',()=>{
 assert.ok(historicalReleaseBlockers(manifest).length>=3);
 assert.throws(()=>assertHistoricalReleaseApproved(manifest),/NO-GO/);
});
test('forged status or approval flag cannot bypass source chain and ballot-scope signoff',()=>{
 const m=structuredClone(manifest);
 m.releaseApproved=true;m.dataStatus='official';m.payloadSha256='a'.repeat(64);
 assert.throws(()=>assertHistoricalReleaseApproved(m),/publisher byte|rights|scope/);
 m.sourceAuthentication.officialByteIdentical=true;
 assert.throws(()=>assertHistoricalReleaseApproved(m),/publisher byte/);
});
test('gate requires exact runtime getter status literal and source audits',()=>{
 const m=structuredClone(manifest);
 m.releaseApproved=true;m.dataStatus='official';m.payloadSha256='a'.repeat(64);
 m.rights={approvalStatus:'approved',reviewedBy:'conductor',reviewedAt:'2026-11-15'};
 m.ballotScope.approvedSevenTicketOnly=true;
 m.sourceAuthentication.officialByteIdentical=true;
 m.sourceAuthentication.independentPublisherEvidence={
  url:m.sourceUrl,retrievedAt:'2026-11-15',
  countySha256:m.sourceSha256,precinctSha256:m.precinctSourceSha256
 };
 assert.equal(assertHistoricalReleaseApproved(m),true);
 m.rights.approvalStatus='Conductor approved factual normalization';
 assert.throws(()=>assertHistoricalReleaseApproved(m),/rights signoff/);
 m.rights.approvalStatus='approved';
 m.sourceAuthentication.independentPublisherEvidence.countySha256='b'.repeat(64);
 assert.throws(()=>assertHistoricalReleaseApproved(m),/publisher byte/);
 m.sourceAuthentication.independentPublisherEvidence.countySha256=m.sourceSha256;
 m.printedCandidateTotals[0]++;
 assert.throws(()=>assertHistoricalReleaseApproved(m),/ballot vector/);
});
