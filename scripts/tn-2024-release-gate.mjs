import {OFFICIAL_STATEWIDE} from './tn-2024-sos-lib.mjs';
const isSha=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
export function historicalReleaseBlockers(m) {
 const errors=[];
 if(!m || typeof m!=='object') return ['invalid provenance manifest'];
 if(m.releaseApproved!==true || m.dataStatus!=='official') errors.push('release not approved and official');
 if(!isSha(m.sourceSha256)||!isSha(m.precinctSourceSha256)||!isSha(m.payloadSha256)||!isSha(m.countyRowsSha256)) errors.push('missing required SHA-256 provenance');
 if(m.sourceAuthentication?.officialByteIdentical!==true ||
    !m.sourceAuthentication?.independentPublisherEvidence?.url ||
    !m.sourceAuthentication?.independentPublisherEvidence?.retrievedAt ||
    m.sourceAuthentication?.independentPublisherEvidence?.countySha256!==m.sourceSha256 ||
    m.sourceAuthentication?.independentPublisherEvidence?.precinctSha256!==m.precinctSourceSha256) {
   errors.push('independent SOS publisher byte acquisition not established');
 }
 if(m.rights?.approvalStatus!=='approved' || !m.rights?.reviewedBy || !m.rights?.reviewedAt) errors.push('conductor rights signoff absent');
 if(m.ballotScope?.approvedSevenTicketOnly!==true) errors.push('seven-ticket scope not expressly approved');
 if(!Array.isArray(m.printedCandidateTotals)||m.printedCandidateTotals.length!==7||
    !m.printedCandidateTotals.every((x,i)=>x===OFFICIAL_STATEWIDE[i])||m.printedTicketTotal!==3063942) {
   errors.push('published ballot vector inconsistent');
 }
 return errors;
}
export function assertHistoricalReleaseApproved(m) {
 const blockers=historicalReleaseBlockers(m);
 if(blockers.length) throw new Error('TN 2024 historical release NO-GO: '+blockers.join('; '));
 return true;
}
