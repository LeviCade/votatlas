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
  if(!metadata.releaseApproved || metadata.dataStatus!=='official' ||
     !/^[a-f0-9]{64}$/.test(metadata.sourceSha256??'') ||
     !/^[a-f0-9]{64}$/.test(metadata.payloadSha256??'')) {
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
  return result;
}
