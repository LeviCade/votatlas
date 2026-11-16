#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {inspectOfficeBytes} from './tn-2024-office-lib.mjs';
const source=process.argv[2];
if(!source || process.argv.length!==3) throw new Error('Usage: node scripts/audit-tennessee-2024-office.mjs /path/to/20241105GeneralbyOffice.pdf');
const bytes=readFileSync(source);
const text=execFileSync('pdftotext',['-layout','-f','1','-l','1',source,'-'],
 {encoding:'utf8',maxBuffer:1024*1024});
const report=inspectOfficeBytes(bytes,text);
console.log(JSON.stringify({
 status:'NUMERIC_RECONCILIATION_ONLY_NOT_PUBLISHER_BYTE_AUTHENTICATION',
 source:'owner-supplied by-office report (not automatically official publisher download)',
 ...report,writeIns:null,undervotes:null,ballotsCast:null
},null,2));
