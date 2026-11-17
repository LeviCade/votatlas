import {describe,it,expect} from 'vitest';
import {getTennesseeAcs2024CountyMarginals,getTennesseeAcs2024Provenance,CensusPopulationDataUnavailableError,getTennessee2024PresidentialFixture,HistoricalElectionUnavailableError} from './index.js';
import {expectedTennesseeGeoIds} from './tennessee.js';
describe('2024 ACS 5-year county population marginals',()=>{
 it('does not substitute fictional values for unavailable source rows',()=>{
  const p=getTennesseeAcs2024Provenance();
  if(p.releaseStatus!=='verified-census-source'){
   expect(()=>getTennesseeAcs2024CountyMarginals('age')).toThrow(CensusPopulationDataUnavailableError);
   expect(()=>getTennesseeAcs2024CountyMarginals('education')).toThrow(CensusPopulationDataUnavailableError);
   return;
  }
  for(const dimension of ['age','education'] as const){
   const rows=getTennesseeAcs2024CountyMarginals(dimension);
   expect(rows).toHaveLength(95);
   expect(rows.map(row=>row.geoId)).toEqual(expectedTennesseeGeoIds());
   for(const row of rows){
    expect(row.categories.reduce((sum,cat)=>sum+cat.estimate,0)).toBe(row.universeEstimate);
    expect(row.categories.every(cat=>cat.moe90===null||(cat.sourceEstimateVariables.length===1&&Number.isSafeInteger(cat.moe90)&&cat.moe90>=0))).toBe(true);
    expect(row.universe).toBe(dimension==='age'?'population_18_plus':'population_25_plus');
    expect(Object.isFrozen(row.categories[0])).toBe(true);
   }
  }
 });
 it('preserves separate historical election source no-go and immutable provenance',()=>{
  const p=getTennesseeAcs2024Provenance();
  expect(Object.isFrozen(p)).toBe(true);
  expect(()=>getTennesseeAcs2024CountyMarginals('race' as 'age')).toThrow(TypeError);
  expect(()=>getTennessee2024PresidentialFixture()).toThrow(HistoricalElectionUnavailableError);
 });
});