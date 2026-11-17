import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
export const DATASET_ID='tn-2024-acs5-county-population-marginals-v1';
export const TABLES=Object.freeze({B01001:49,B15003:25});
export const SOURCE_DIRECTORY='https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const serialize=value=>JSON.stringify(value,null,2)+'\n';
const ensure=(ok,message)=>{if(!ok)throw Error('ACS 2024 source: '+message)};
const v=(table,i,measure)=>table+'_'+measure+String(i).padStart(3,'0');
export const apiVariable=(table,i,measure)=>table+'_'+String(i).padStart(3,'0')+measure;
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
export const AGE_CATEGORIES=Object.freeze([
['18-24','18–24 years',[...range(7,10),...range(31,34)]],
['25-34','25–34 years',[11,12,35,36]],
['35-44','35–44 years',[13,14,37,38]],
['45-54','45–54 years',[15,16,39,40]],
['55-64','55–64 years',[17,18,19,41,42,43]],
['65-plus','65 years and over',[...range(20,25),...range(44,49)]]
]);
export const EDUCATION_CATEGORIES=Object.freeze([
['less-than-high-school','Less than high school diploma',range(2,16)],
['high-school-equivalent','High school graduate or equivalency',[17,18]],
['some-college-associate','Some college or associate degree',[19,20,21]],
['bachelors','Bachelor’s degree',[22]],
['graduate-professional','Graduate or professional degree',[23,24,25]]
]);
export function parseTableExtract(text,table,refs){
 ensure(Object.hasOwn(TABLES,table),'unsupported table');
 ensure(Array.isArray(refs)&&refs.length===95,'exactly 95 county reference IDs required');
 const names=new Map(refs.map(ref=>[ref.geoId,ref.name]));
 ensure(names.size===95&&refs.every((ref,i)=>ref.geoId==='47'+String(i*2+1).padStart(3,'0')&&ref.name.endsWith(' County')),'invalid Census 2020 FIPS crosswalk');
 ensure(typeof text==='string','invalid source text');
 const lines=text.trimEnd().split(/\r?\n/);
 ensure(lines.length===96,'expected 1 header and 95 county rows, got '+lines.length);
 const header=lines[0].split('|'),expected=['GEO_ID'];
 for(let i=1;i<=TABLES[table];i++)expected.push(v(table,i,'E'),v(table,i,'M'));
 ensure(JSON.stringify(header)===JSON.stringify(expected),'table variable headers missing/reordered/duplicated: '+table);
 const rows=[],seen=new Set();
 for(const [index,line] of lines.slice(1).entries()){
  const cells=line.split('|');
  ensure(cells.length===header.length,'column count mismatch at '+index);
  const geoId=/^0500000US(47\d{3})$/.exec(cells[0])?.[1];
  ensure(geoId&&names.has(geoId),'unrecognized Tennessee county GEO_ID '+cells[0]);
  ensure(!seen.has(geoId),'duplicate GEO_ID '+geoId);seen.add(geoId);
  const values={};
  for(let i=1;i<=TABLES[table];i++){
   const est=cells[(i-1)*2+1],moe=cells[(i-1)*2+2];
   ensure(/^(0|[1-9]\d*)$/.test(est),'missing/negative/suppressed estimate '+v(table,i,'E')+' '+geoId);
   const estimate=Number(est);ensure(Number.isSafeInteger(estimate),'unsafe estimate '+geoId);
   let moe90=null,moeStatus='unavailable';
   if(/^(0|[1-9]\d*)$/.test(moe)&&!/^(?:222222222|333333333|444444444|555555555|666666666|777777777|888888888|999999999)$/.test(moe)){
    moe90=Number(moe);ensure(Number.isSafeInteger(moe90),'unsafe MOE '+geoId);moeStatus='reported';
   }else ensure(/^-?\d+$/.test(moe),'missing/sentinel MOE must be explicit '+v(table,i,'M')+' '+geoId);
   values[apiVariable(table,i,'E')]={estimate,moe90,moeStatus,sourceEstimateVariable:v(table,i,'E'),sourceMoeVariable:v(table,i,'M')};
  }
  rows.push({geoId,name:names.get(geoId),cells:values});
 }
 ensure(rows.every((row,i)=>row.geoId===refs[i].geoId),'county order/crosswalk mismatch');
 return rows;
}
const sum=rows=>rows.reduce((a,b)=>{const x=a+b;ensure(Number.isSafeInteger(x),'integer overflow');return x},0);
const value=(row,table,n)=>row.cells[apiVariable(table,n,'E')].estimate;
export function convertMarginal(rows,dimension){
 ensure(rows.length===95,'95 source rows required');
 const age=dimension==='age';ensure(age||dimension==='education','invalid dimension');
 const table=age?'B01001':'B15003',categories=age?AGE_CATEGORIES:EDUCATION_CATEGORIES;
 return rows.map(row=>{
  const get=n=>value(row,table,n);
  if(age){
   ensure(get(2)===sum(range(3,25).map(get))&&get(26)===sum(range(27,49).map(get)),'sex subtotal mismatch '+row.geoId);
   ensure(get(1)===get(2)+get(26),'population total mismatch '+row.geoId);
  }else ensure(get(1)===sum(range(2,25).map(get)),'education 25+ universe mismatch '+row.geoId);
  const groups=categories.map(([id,label,indices])=>({id,label,estimate:sum(indices.map(get)),moe90:indices.length===1?row.cells[apiVariable(table,indices[0],'E')].moe90:null,
   sourceEstimateVariables:indices.map(i=>apiVariable(table,i,'E')),sourceMoeVariables:indices.map(i=>apiVariable(table,i,'M'))}));
  const universeEstimate=age?sum(groups.map(g=>g.estimate)):get(1);
  ensure(universeEstimate===sum(groups.map(g=>g.estimate)),'derived partition mismatch '+row.geoId);
  if(age)ensure(universeEstimate+sum([...range(3,6),...range(27,30)].map(get))===get(1),'adult total mismatch '+row.geoId);
  return {geoId:row.geoId,countyName:row.name,dimension,tableId:table,
   universe:age?'population_18_plus':'population_25_plus',universeEstimate,
   universeMoe90:age?null:row.cells[apiVariable(table,1,'E')].moe90,
   sourceTotalEstimate:get(1),sourceTotalMoe90:row.cells[apiVariable(table,1,'E')].moe90,categories:groups};
 });
}
export async function extractOfficialTable(path,table,refs){
 ensure(Object.hasOwn(TABLES,table),'unsupported source table');
 const hash=createHash('sha256'),lines=[];let count=0,header=null;
 const stream=createReadStream(path);stream.on('data',chunk=>hash.update(chunk));
 for await(const line of createInterface({input:stream,crlfDelay:Infinity})){
  if(count++===0){header=line;continue}
  if(line.startsWith('0500000US47'))lines.push(line);
 }
 ensure(count>95,'full Census original required, not prefiltered substitute');
 const text=[header,...lines].join('\n')+'\n';
 parseTableExtract(text,table,refs);
 return {text,fullSourceSha256:hash.digest('hex'),rawExtractSha256:sha256(text),originalLineCount:count,countyRows:lines.length};
}
export function verifyDataset(dataset,refs){
 ensure(dataset?.datasetId===DATASET_ID&&dataset.source==='US_CENSUS_2024_ACS_5YEAR','wrong source/dataset ID');
 ensure(dataset.age?.length===95&&dataset.education?.length===95,'incomplete county profile arrays');
 for(const dimension of ['age','education']){
  dataset[dimension].forEach((p,i)=>{
   ensure(p.geoId===refs[i].geoId&&p.dimension===dimension,'GEOID/dimension mismatch');
   ensure(p.universe===(dimension==='age'?'population_18_plus':'population_25_plus'),'universe conflation');
   ensure(p.categories.length===(dimension==='age'?6:5),'category count invalid');
   ensure(p.categories.every(c=>Number.isSafeInteger(c.estimate)&&c.estimate>=0&&(c.moe90===null||(c.sourceEstimateVariables.length===1&&Number.isSafeInteger(c.moe90)&&c.moe90>=0))),'invalid category/MOE');
   ensure(sum(p.categories.map(c=>c.estimate))===p.universeEstimate,'partition not conserved');
  });
 }
 return dataset;
}