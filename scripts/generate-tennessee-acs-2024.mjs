#!/usr/bin/env node
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DATASET_ID,SOURCE_DIRECTORY,sha256,serialize,extractOfficialTable,parseTableExtract,convertMarginal,verifyDataset} from './acs-2024-source-lib.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=resolve(root,'packages/data/fixtures');
const refs=JSON.parse(readFileSync(resolve(base,'tennessee-counties-2020.json')));
const inputPath=t=>resolve(base,'acs-2024-'+t.toLowerCase()+'-tn-original-rows.dat');
const outputPath=resolve(base,'tennessee-acs-2024-marginals.v1.json');
const provenancePath=resolve(base,'tennessee-acs-2024-provenance.json');
const args=process.argv.slice(2),option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
const write=args.includes('--write'),check=args.includes('--check');
if(Number(write)+Number(check)!==1)throw Error('Usage: --check | --write --age-full /path/acsdt5y2024-b01001.dat --education-full /path/acsdt5y2024-b15003.dat');
function generate(){
 const raw={},profiles={};
 for(const [t,dim] of [['B01001','age'],['B15003','education']]){
  const bytes=readFileSync(inputPath(t));
  raw[t]={bytes:bytes.length,sha256:sha256(bytes)};
  profiles[dim]=convertMarginal(parseTableExtract(bytes.toString('utf8'),t,refs),dim);
 }
 const dataset=verifyDataset({datasetId:DATASET_ID,source:'US_CENSUS_2024_ACS_5YEAR',vintage:'2020-2024',
  referenceYear:2024,geographyVintage:2020,age:profiles.age,education:profiles.education},refs);
 return {raw,rendered:serialize(dataset)};
}
if(check){
 const manifest=JSON.parse(readFileSync(provenancePath)),staged=JSON.parse(readFileSync(outputPath));
 if(manifest.releaseStatus==='blocked'){
  if(staged.availability!=='blocked'||staged.age||staged.education||manifest.payloadSha256!==null)throw Error('Unverified ACS records marked as published');
  if(['B01001','B15003'].some(t=>existsSync(inputPath(t))))throw Error('Unreviewed raw sources staged under blocked provenance');
  console.log('PASS ACS demographic fixture remains source BLOCKED, no invented observations');process.exit(0);
 }
 if(manifest.releaseStatus!=='verified-census-source'||manifest.publisher!=='United States Census Bureau'||manifest.datasetId!==DATASET_ID)throw Error('Source provenance invalid');
 const {raw,rendered}=generate();
 if(manifest.payloadSha256!==sha256(rendered)||readFileSync(outputPath,'utf8')!==rendered)throw Error('Dataset byte replay/hash mismatch');
 if(['B01001','B15003'].some(t=>manifest.tables[t]?.extractSha256!==raw[t].sha256||
  manifest.tables[t]?.extractBytes!==raw[t].bytes||!/^[0-9a-f]{64}$/.test(manifest.tables[t]?.fullSourceSha256??'')))throw Error('Raw source checksum/full original fingerprint mismatch');
 console.log('PASS verified 2024 Census ACS 5-year 95-county age/education replay '+sha256(rendered));
}else{
 const age=option('--age-full'),education=option('--education-full');
 if(!age||!education)throw Error('Full original Census source files required');
 const full={};
 for(const [t,path] of [['B01001',age],['B15003',education]])full[t]=await extractOfficialTable(path,t,refs);
 for(const t of ['B01001','B15003'])writeFileSync(inputPath(t),full[t].text);
 const {raw,rendered}=generate();
 const tables=Object.fromEntries(['B01001','B15003'].map(t=>[t,{
  tableId:t,sourceUrl:SOURCE_DIRECTORY+'acsdt5y2024-'+t.toLowerCase()+'.dat',
  sourceFormat:'Census pipe-delimited 2024 ACS 5-year table-based Summary File',
  fullSourceSha256:full[t].fullSourceSha256,fullSourceLines:full[t].originalLineCount,
  extractSha256:full[t].rawExtractSha256,extractBytes:raw[t].bytes,
  countyRows:full[t].countyRows,estimateColumns:t==='B01001'?49:25,moeColumns:t==='B01001'?49:25
 }]));
 const manifest={schemaVersion:1,datasetId:DATASET_ID,releaseStatus:'verified-census-source',
  publisher:'United States Census Bureau',referenceYear:2024,vintage:'2020-2024',
  dataset:'2024 ACS 5-year Detailed Tables — Table-Based Summary File',
  dataType:'resident population estimates, NOT registered voters, ballots or voter preferences',
  geography:'Census 2020 five-digit Tennessee county GEOID crosswalk, 95 counties',tables,
  payloadSha256:sha256(rendered),sourceAcquisition:'Full official Census HTTPS originals SHA-256 pinned; downstream review must verify retrieval chain',
  estimatedMarginsOfError:'All original source E/M variable pairs retained in raw extracts; negative and Census 9-digit special MOE codes are null; derived category/adult MOE not computed without covariance',
  denominatorAge:'B01001 18+ resident population recombined from 6 disjoint adult age bands',
  denominatorEducation:'B15003_001 population ages 25+',
  overlapPolicy:'Age and education are different overlapping marginals, NEVER a combined partition',
  rights:'U.S. federal government Census factual data, 17 USC 105; attribution required; no endorsement implied'};
 writeFileSync(outputPath,rendered);writeFileSync(provenancePath,serialize(manifest));
 console.log('WROTE 2024 ACS 5-year 95-county population profiles; payload sha256='+manifest.payloadSha256);
}