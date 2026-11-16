#!/usr/bin/env python3
"""Read-only inventory of an ORIGINAL SOS XLSX; never infers ballot totals."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAX_TOTAL_UNCOMPRESSED = 100_000_000
MAX_XML_FILE = 20_000_000
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

def inventory(path):
    b = Path(path).read_bytes()
    if not b.startswith(b'PK\\x03\\x04'):
        raise ValueError('not XLSX/ZIP original bytes')
    with zipfile.ZipFile(path) as f:
        names = f.namelist()
        if len(set(names)) != len(names):
            raise ValueError('duplicate ZIP entries')
        if any(x.filename.startswith('/') or '..' in x.filename.split('/') for x in f.infolist()):
            raise ValueError('unsafe ZIP member path')
        if sum(x.file_size for x in f.infolist()) > MAX_TOTAL_UNCOMPRESSED:
            raise ValueError('excessive uncompressed source size')
        for entry in f.infolist():
            if entry.filename.endswith('.xml') and entry.file_size > MAX_XML_FILE:
                raise ValueError('excessive individual XML size')
        required = {'[Content_Types].xml', 'xl/workbook.xml'}
        if not required.issubset(names):
            raise ValueError('missing XLSX workbook metadata')
        wb = ET.fromstring(f.read('xl/workbook.xml'))
        sheets = [x.attrib.get('name') for x in wb.iter(S + 'sheet')]
        if not sheets:
            raise ValueError('no workbook sheets')
        shared = []
        if 'xl/sharedStrings.xml' in names:
            root = ET.fromstring(f.read('xl/sharedStrings.xml'))
            for item in root.iter(S + 'si'):
                shared.append(''.join(x.text or '' for x in item.iter(S + 't')))
        tokens = ('President', 'Write-In', 'Undervote', 'Ballots Cast', 'Turnout')
        matched = {label:sum(label.lower() in cell.lower() for cell in shared) for label in tokens}
        return {'status':'INVENTORY_NOT_ELECTION_VALIDATION',
                'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),
                'sheets':sheets,'sharedStringCount':len(shared),
                'labelOccurrencesInSharedStrings':matched,
                'precinctPresidentialRows':None,'writeIns':None,
                'undervotes':None,'ballotsCast':None}

if __name__ == '__main__':
    if len(sys.argv)!=2: sys.exit('Usage: python3 scripts/tn-2024-xlsx-inventory.py /path/to/20241105AllbyPrecinct.xlsx')
    print(json.dumps(inventory(sys.argv[1]),indent=2))
