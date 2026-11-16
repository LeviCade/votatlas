import draft from '../fixtures/tennessee-2024-presidential.v1.json' with { type:'json' };
import source from '../fixtures/tennessee-2024-provenance.json' with { type:'json' };
import { validateElectionDataset } from './validation.js';
import type { ElectionDataset } from './validation.js';
import { expectedTennesseeGeoIds } from './tennessee.js';
export interface Tennessee2024SourceProvenance {
  schemaVersion:number; datasetId:string; sourceUrl:string; officeUrl:string;
  sourceSha256:string|null; payloadSha256:string|null; dataStatus:string;
  releaseApproved:boolean; reason:string; [key:string]:unknown;
}
export class HistoricalElectionUnavailableError extends Error {
  override name='HistoricalElectionUnavailableError';
}
export function getTennessee2024PresidentialProvenance():Tennessee2024SourceProvenance {
  return structuredClone(source) as unknown as Tennessee2024SourceProvenance;
}
export function getTennessee2024PresidentialFixture():ElectionDataset {
  const metadata=getTennessee2024PresidentialProvenance();
  const auth=metadata.sourceAuthentication as {officialByteIdentical?:boolean; independentPublisherEvidence?:{url?:string;retrievedAt?:string;countySha256?:string;precinctSha256?:string}}|undefined;
  const rights=metadata.rights as {approvalStatus?:string;reviewedBy?:string;reviewedAt?:string}|undefined;
  const scope=metadata.ballotScope as {approvedSevenTicketOnly?:boolean}|undefined;
  if(!metadata.releaseApproved || metadata.dataStatus!=='official' ||
     !/^[a-f0-9]{64}$/.test(metadata.sourceSha256??'') ||
     !/^[a-f0-9]{64}$/.test(metadata.payloadSha256??'') ||
     auth?.officialByteIdentical!==true ||
     auth?.independentPublisherEvidence?.url!==metadata.sourceUrl ||
     !auth?.independentPublisherEvidence?.retrievedAt ||
     auth?.independentPublisherEvidence?.countySha256!==metadata.sourceSha256 ||
     auth?.independentPublisherEvidence?.precinctSha256!==metadata.precinctSourceSha256 ||
     rights?.approvalStatus!=='approved' || !rights.reviewedBy || !rights.reviewedAt ||
     scope?.approvedSevenTicketOnly!==true) {
    throw new HistoricalElectionUnavailableError('Tennessee 2024 historical fixture blocked: '+metadata.reason);
  }
  const result=validateElectionDataset(structuredClone(draft),{
    requiredGeoIds:expectedTennesseeGeoIds(),expectedStateId:'47'
  });
  if(result.election.id!==metadata.datasetId || result.election.year!==2024 ||
     result.election.dataStatus!=='official' || result.election.candidates.length!==7 ||
     result.units.some(row=>row.eligibleVoters!==null)) {
    throw new HistoricalElectionUnavailableError('Unapproved / inconsistent historical data');
  }
  const ids=['tn24-trump-vance','tn24-harris-walz','tn24-bowman-bowman','tn24-delacruz-garcia',
    'tn24-fruit-richter','tn24-kennedy-shanahan','tn24-stein-kpadenou'];
  const totals=[1966865,1056265,5865,3457,988,21535,8967];
  if(result.election.candidates.some((candidate,i)=>candidate.id!==ids[i] || candidate.ballotOrder!==i) ||
     ids.some((id,i)=>result.units.reduce((sum,unit)=>sum+(unit.votes[id]??0),0)!==totals[i])) {
    throw new HistoricalElectionUnavailableError('Published ticket identities or official totals differ from SOS source');
  }
  return result;
}
