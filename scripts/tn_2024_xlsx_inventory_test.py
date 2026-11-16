import importlib.util
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "tn_2024_xlsx_inventory",
    str(Path(__file__).with_name("tn-2024-xlsx-inventory.py"))
)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

def make_file(p, duplicate=False):
    ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    entries=[
      ('[Content_Types].xml','<Types/>'),
      ('xl/workbook.xml',f'<workbook xmlns="{ns}"><sheets><sheet name="Tennessee"/></sheets></workbook>'),
      ('xl/sharedStrings.xml',f'<sst xmlns="{ns}"><si><t>President</t></si><si><t>Write-In</t></si></sst>'),
    ]
    if duplicate: entries.append(entries[1])
    with zipfile.ZipFile(p,'w') as z, warnings.catch_warnings():
        warnings.simplefilter('ignore',UserWarning)
        for name,data in entries: z.writestr(name,data)

class SourceWorkbookIntegrityTests(unittest.TestCase):
    def test_read_only_inventory_is_not_vote_ingestion(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'source.xlsx'
            make_file(p)
            actual=audit.inventory(p)
            self.assertEqual(actual['sheets'],['Tennessee'])
            self.assertEqual(actual['labelOccurrencesInSharedStrings']['Write-In'],1)
            self.assertIsNone(actual['ballotsCast'])
            self.assertIsNone(actual['precinctPresidentialRows'])
    def test_rejects_not_xlsx_and_duplicate_zip_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'source.xlsx'
            p.write_bytes(b'not a ZIP')
            with self.assertRaisesRegex(ValueError,'not XLSX'):audit.inventory(p)
            make_file(p,True)
            with self.assertRaisesRegex(ValueError,'duplicate ZIP'):audit.inventory(p)

if __name__=='__main__':
    unittest.main()
