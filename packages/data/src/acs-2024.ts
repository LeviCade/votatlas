import fixture from '../fixtures/tennessee-acs-2024-marginals.v1.json' with {type:'json'};
import provenance from '../fixtures/tennessee-acs-2024-provenance.json' with {type:'json'};
export type TennesseeAcsDimension='age'|'education';
export interface TennesseeAcsCategory{
 readonly id:string;readonly label:string;readonly estimate:number;
 readonly moe90:number|null;readonly sourceEstimateVariables:readonly string[];readonly sourceMoeVariables:readonly string[];
}
export interface TennesseeAcsCountyMarginal{
 readonly geoId:string;readonly countyName:string;readonly dimension:TennesseeAcsDimension;
 readonly tableId:'B01001'|'B15003';readonly universe:'population_18_plus'|'population_25_plus';
 readonly universeEstimate:number;readonly universeMoe90:number|null;
 readonly sourceTotalEstimate:number;readonly sourceTotalMoe90:number|null;
 readonly categories:readonly TennesseeAcsCategory[];
}
export interface TennesseeAcsProvenance{
 readonly schemaVersion:number;readonly datasetId:string;readonly releaseStatus:string;
 readonly publisher:string;readonly payloadSha256:string|null;readonly [key:string]:unknown;
}
export class CensusPopulationDataUnavailableError extends Error{override name='CensusPopulationDataUnavailableError'}
function deepFreeze<T>(input:T):Readonly<T>{
 if(input!==null&&typeof input==='object'){
  for(const value of Object.values(input))deepFreeze(value);
  Object.freeze(input);
 }
 return input;
}
export function getTennesseeAcs2024Provenance():TennesseeAcsProvenance{
 return deepFreeze(structuredClone(provenance)) as TennesseeAcsProvenance;
}
export function getTennesseeAcs2024CountyMarginals(dimension:TennesseeAcsDimension):readonly TennesseeAcsCountyMarginal[]{
 if(dimension!=='age'&&dimension!=='education')throw new TypeError('Select exactly one ACS marginal dimension: age or education');
 const meta=getTennesseeAcs2024Provenance();
 if(meta.releaseStatus!=='verified-census-source'||!/^[0-9a-f]{64}$/.test(meta.payloadSha256??'')){
  throw new CensusPopulationDataUnavailableError('2024 Census county population estimates unavailable: source verification incomplete');
 }
 const source=fixture as unknown as Record<string,unknown>;
 if(source.datasetId!==meta.datasetId||source.source!=='US_CENSUS_2024_ACS_5YEAR'||
    !Array.isArray(source[dimension])||source[dimension].length!==95){
  throw new CensusPopulationDataUnavailableError('Census dataset inconsistent with provenance');
 }
 const rows=structuredClone(source[dimension]) as TennesseeAcsCountyMarginal[];
 for(const [i,row] of rows.entries()){
  if(!/^47\d{3}$/.test(row.geoId)||(i>0&&row.geoId<=rows[i-1]!.geoId)||
   row.dimension!==dimension||row.tableId!==(dimension==='age'?'B01001':'B15003')||
   row.universe!==(dimension==='age'?'population_18_plus':'population_25_plus')||
   !Number.isSafeInteger(row.universeEstimate)||row.universeEstimate<0||
   !Array.isArray(row.categories)||row.categories.length!==(dimension==='age'?6:5)||
   row.categories.some(c=>!Number.isSafeInteger(c.estimate)||c.estimate<0)||
   row.categories.reduce((sum,c)=>sum+c.estimate,0)!==row.universeEstimate){
   throw new CensusPopulationDataUnavailableError('Invalid Census county marginal population partition');
  }
 }
 return deepFreeze(rows);
}

/** Adapter for E2's hypothetical population-to-electorate model; source data remain observed ACS populations. */
export interface TennesseeAcsCompositionSourceProvenance {
 readonly publisher:'US Census Bureau';
 readonly survey:'ACS';
 readonly surveyYear:2024;
 readonly period:'5-year';
 readonly geographyVintage:'2020';
 readonly sourceUrl:string;
 readonly sourceDigest:string;
 readonly releaseStatus:'verified';
 readonly dimension:TennesseeAcsDimension;
 readonly tableId:'B01001'|'B15003';
}
export function getTennesseeAcs2024CompositionSourceProvenance(dimension:TennesseeAcsDimension):TennesseeAcsCompositionSourceProvenance{
 getTennesseeAcs2024CountyMarginals(dimension);
 const m=getTennesseeAcs2024Provenance();
 const tableId=dimension==='age'?'B01001':'B15003';
 const table=(m.tables as Record<string,{sourceUrl:string;fullSourceSha256:string}>|undefined)?.[tableId];
 if(!table||!/^https:\/\/www2\.census\.gov\//.test(table.sourceUrl)||!/^[0-9a-f]{64}$/.test(table.fullSourceSha256)){
  throw new CensusPopulationDataUnavailableError('Verified first-party Census source digest unavailable');
 }
 return Object.freeze({
  publisher:'US Census Bureau',survey:'ACS',surveyYear:2024,period:'5-year',
  geographyVintage:'2020',sourceUrl:table.sourceUrl,
  sourceDigest:'sha256:'+table.fullSourceSha256,
  releaseStatus:'verified',dimension,tableId
 });
}
