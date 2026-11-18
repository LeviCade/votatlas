import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TABLES,sha256,parseTableExtract,convertMarginal,verifyDataset,apiVariable,extractOfficialTable} from './acs-2024-source-lib.mjs';
const refs=Array.from({length:95},(_,i)=>({geoId:'47'+String(i*2+1).padStart(3,'0'),name:'County'+i+' County'}));
function sample(t,mutate=null,headerMutate=null){
 const n=TABLES[t],header=['GEO_ID'];
 for(let i=1;i<=n;i++)header.push(t+'_E'+String(i).padStart(3,'0'),t+'_M'+String(i).padStart(3,'0'));
 if(headerMutate)headerMutate(header);
 const rows=refs.map((r,index)=>{
  const values=Array.from({length:n},(_,j)=>{
   const i=j+1;
   if(t==='B15003')return i===1||i===2?24:0;
   if(i===1)return 46;if(i===2||i===26)return 23;
   return i===3||i===27?23:0;
  });
  const row=['0500000US'+r.geoId,...values.flatMap((x,i)=>[String(x),i===0?'555555555':'12'])];
  if(mutate)mutate(row,index);
  return row.join('|');
 });
 return [header.join('|'),...rows].join('\n')+'\n';
}
test('95 counties preserve correct age versus education denominators and MOE sentinels',()=>{
 const a=parseTableExtract(sample('B01001'),'B01001',refs);
 const e=parseTableExtract(sample('B15003'),'B15003',refs);
 const age=convertMarginal(a,'age'),education=convertMarginal(e,'education');
 assert.equal(age.length,95);assert.equal(education.length,95);
 assert.equal(age[0].universe,'population_18_plus');
 assert.equal(education[0].universe,'population_25_plus');
 assert.equal(age[0].universeEstimate,0);assert.equal(education[0].universeEstimate,24);
 assert.equal(age[0].sourceTotalMoe90,null);
 assert.equal(a[0].cells[apiVariable('B01001',3,'E')].moe90,12);
 assert.equal(education[0].categories.find(c=>c.id==='bachelors').moe90,12);
 assert.equal(education[0].categories.find(c=>c.id==='high-school-equivalent').moe90,null);
 const d={datasetId:'tn-2024-acs5-county-population-marginals-v1',source:'US_CENSUS_2024_ACS_5YEAR',age,education};
 assert.throws(()=>verifyDataset(d,refs),/population 25\+ differs/);
});
test('reject altered sex subtotals and education 25+ universe',()=>{
 const a=parseTableExtract(sample('B01001'),'B01001',refs);a[0].cells.B01001_002E.estimate++;
 assert.throws(()=>convertMarginal(a,'age'),/sex subtotal/);
 const e=parseTableExtract(sample('B15003'),'B15003',refs);e[0].cells.B15003_001E.estimate++;
 assert.throws(()=>convertMarginal(e,'education'),/universe mismatch/);
});
test('reject missing or duplicated counties, reordered cells and wrong geography',()=>{
 assert.throws(()=>parseTableExtract(sample('B15003',null,h=>[h[1],h[2]]=[h[2],h[1]]),'B15003',refs),/headers/);
 assert.throws(()=>parseTableExtract(sample('B15003').trimEnd().split('\n').slice(0,-1).join('\n'),'B15003',refs),/expected 1 header/);
 assert.throws(()=>parseTableExtract(sample('B15003',(r,i)=>{if(i===1)r[0]='0500000US47001'}),'B15003',refs),/duplicate GEO_ID/);
 assert.throws(()=>parseTableExtract(sample('B15003',(r,i)=>{if(i===0)r[0]='0500000US48001'}),'B15003',refs),/unrecognized/);
 const lines=sample('B15003').trimEnd().split('\n');[lines[1],lines[2]]=[lines[2],lines[1]];
 assert.throws(()=>parseTableExtract(lines.join('\n'),'B15003',refs),/order/);
});
test('unknown/suppressed estimates are not silently converted to 0',()=>{
 for(const invalid of ['','null','-666666666','-1','(X)','1.5']){
  assert.throws(()=>parseTableExtract(sample('B15003',(r,i)=>{if(i===0)r[3]=invalid}),'B15003',refs),/estimate/);
 }
 assert.throws(()=>parseTableExtract(sample('B01001',(r,i)=>{if(i===0)r[4]='unknown'}),'B01001',refs),/MOE/);
});
test('full official table bytes hashed and only 95 TN county rows selected',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tn-acs-'));
 try{
  const source=sample('B15003'),extra='0500000US48001'+('|0|0'.repeat(25))+'\n';
  const path=join(dir,'original.dat');writeFileSync(path,source+extra);
  const result=await extractOfficialTable(path,'B15003',refs);
  assert.equal(result.fullSourceSha256,sha256(source+extra));
  assert.equal(result.rawExtractSha256,sha256(source));
  assert.equal(result.originalLineCount,97);
  assert.equal(result.countyRows,95);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('cross-table ACS age-derived 25+ universe matches B15003 25+ in every county',()=>{
 const age=convertMarginal(parseTableExtract(sample('B01001'),'B01001',refs),'age');
 const education=convertMarginal(parseTableExtract(sample('B15003'),'B15003',refs),'education');
 const d={datasetId:'tn-2024-acs5-county-population-marginals-v1',source:'US_CENSUS_2024_ACS_5YEAR',age,education};
 assert.throws(()=>verifyDataset(d,refs),/population 25\+ differs/);
 // Synthetic test differs intentionally: B01001 adult 25+ is zero, B15003 is 24.
 // A fixture with matching universes must pass.
 education.forEach(row=>{row.universeEstimate=0;row.categories[0].estimate=0;row.categories[1].estimate=0;row.categories[2].estimate=0;row.categories[3].estimate=0;row.categories[4].estimate=0;});
 assert.equal(verifyDataset(d,refs),d);
});
