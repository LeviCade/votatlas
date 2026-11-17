import * as data from "@votatlas/data";

/** Only Census-derived population estimates enter this adapter, never ballots, voter
 * registrations, subgroup turnout or candidate preferences. The data package owns
 * acquisition and verification of raw ACS source records. */
export type AcsDimension = "age" | "education";
export interface AcsCategory {
  id: string;
  label: string;
  estimate: number;
  moe90: number | null;
  sourceEstimateVariables: readonly string[];
  sourceMoeVariables: readonly string[];
}
export interface AcsCountyMarginal {
  geoId: string;
  countyName: string;
  dimension: AcsDimension;
  tableId: "B01001" | "B15003";
  universe: "population_18_plus" | "population_25_plus";
  universeEstimate: number;
  universeMoe90: number | null;
  categories: readonly AcsCategory[];
}
type AcsApi = {
  getTennesseeAcs2024CountyMarginals?: (dimension: AcsDimension) => readonly AcsCountyMarginal[];
  getTennesseeAcs2024Provenance?: () => unknown;
};
const api = data as typeof data & AcsApi;
export interface AvailableAcsSource {
  status: "available";
  dimension: AcsDimension;
  rows: readonly AcsCountyMarginal[];
  provenance: unknown;
}
export interface UnavailableAcsSource {
  status: "unavailable";
  dimension: AcsDimension;
  reason: string;
}
export type AcsSourceState = AvailableAcsSource | UnavailableAcsSource;
const metadata: Record<AcsDimension, {table:"B01001"|"B15003";universe:"population_18_plus"|"population_25_plus"}> = {
  age: {table:"B01001",universe:"population_18_plus"},
  education: {table:"B15003",universe:"population_25_plus"},
};
export function acsDimensionLabel(dimension: AcsDimension): string {
  return dimension === "age" ? "Age · adults 18+" : "Education · adults 25+";
}
export function acsUniverseLabel(dimension: AcsDimension): string {
  return dimension === "age" ? "Estimated residents age 18 and older" : "Estimated residents age 25 and older";
}
function assertAcsRows(dimension:AcsDimension,rows:readonly AcsCountyMarginal[]): void {
  const expected=new Set(data.expectedTennesseeGeoIds());
  if(rows.length!==expected.size || expected.size!==95) throw Error("Verified ACS source must cover all 95 Tennessee counties.");
  const observed=new Set<string>();
  let cohortOrder:string[]|null=null;
  for(const row of rows){
    if(!expected.has(row.geoId)||observed.has(row.geoId))throw Error("ACS rows contain an unknown or duplicate Tennessee county.");
    observed.add(row.geoId);
    if(row.dimension!==dimension||row.tableId!==metadata[dimension].table||row.universe!==metadata[dimension].universe)
      throw Error("ACS age 18+ and education 25+ denominators must remain separate.");
    if(!Number.isSafeInteger(row.universeEstimate)||row.universeEstimate<0)
      throw Error("Invalid or suppressed ACS population universe.");
    if(!Array.isArray(row.categories)||row.categories.length===0) throw Error("ACS categories are missing.");
    const ids=new Set<string>(), variables=new Set<string>();
    let sum=0;
    for(const group of row.categories){
      if(typeof group.id!=="string"||!group.id||ids.has(group.id)||
        !Number.isSafeInteger(group.estimate)||group.estimate<0)
        throw Error("Invalid, duplicate or suppressed ACS population category.");
      ids.add(group.id);
      sum+=group.estimate;
      if(!Array.isArray(group.sourceEstimateVariables)||!group.sourceEstimateVariables.length)
        throw Error("ACS category lacks its actual source variable IDs.");
      for(const variable of group.sourceEstimateVariables) {
        if(!new RegExp(`^${metadata[dimension].table}_[0-9]{3}E$`).test(variable)||variables.has(variable))
          throw Error("ACS source variables are missing, duplicated or from the wrong table.");
        variables.add(variable);
      }
    }
    if(sum!==row.universeEstimate)throw Error("ACS categories do not sum to their source population universe.");
    const order=row.categories.map(group=>group.id);
    if(cohortOrder!==null&&JSON.stringify(order)!==JSON.stringify(cohortOrder))
      throw Error("ACS county category definitions are inconsistent.");
    cohortOrder=order;
  }
}
export function readTennesseeAcs(dimension:AcsDimension):AcsSourceState {
  if(typeof api.getTennesseeAcs2024CountyMarginals!=="function"||
      typeof api.getTennesseeAcs2024Provenance!=="function")
    return {status:"unavailable",dimension,
      reason:"The source-verified 2024 ACS five-year Tennessee county profiles are not yet integrated. No ACS population shares have been invented."};
  try {
    const rows=api.getTennesseeAcs2024CountyMarginals(dimension);
    assertAcsRows(dimension,rows);
    const provenance=api.getTennesseeAcs2024Provenance();
    if(!provenance||typeof provenance!=="object")throw Error("ACS source provenance is unavailable.");
    const meta=provenance as Record<string,unknown>;
    if(meta.releaseStatus!=="verified-census-source"||
      typeof meta.payloadSha256!=="string"||!/^[a-f0-9]{64}$/i.test(meta.payloadSha256))
      throw Error("ACS source release approval and SHA-256 verification are incomplete.");
    return {status:"available",dimension,rows,provenance};
  } catch(cause){
    return {status:"unavailable",dimension,
      reason:cause instanceof Error?cause.message:"Source verified ACS data could not be loaded."};
  }
}
export interface AcsSelectedPopulation {
  categoryTotals: {id:string;label:string;estimate:number;percentage:number;sourceVariables:readonly string[]}[];
  universeEstimate: number;
  countyCount: number;
  dimension: AcsDimension;
}
export function sumSelectedAcsPopulation(source:AvailableAcsSource,selectedIds:readonly string[]):AcsSelectedPopulation {
  const ids=new Set(selectedIds);
  const rows=source.rows.filter(row=>ids.has(row.geoId));
  if(rows.length!==ids.size)throw Error("Selected county has no verified ACS population profile.");
  const universeEstimate=rows.reduce((sum,row)=>sum+row.universeEstimate,0);
  const first=source.rows[0];
  const categoryTotals=(first?.categories??[]).map(group=>{
    const estimate=rows.reduce((sum,row)=>sum+(row.categories.find(c=>c.id===group.id)?.estimate??0),0);
    return {id:group.id,label:group.label,estimate,
      percentage:universeEstimate===0?0:100*estimate/universeEstimate,
      sourceVariables:group.sourceEstimateVariables};
  });
  if(categoryTotals.reduce((sum,c)=>sum+c.estimate,0)!==universeEstimate)
    throw Error("Selected ACS population categories do not conserve the published denominator.");
  return {categoryTotals,universeEstimate,countyCount:rows.length,dimension:source.dimension};
}
