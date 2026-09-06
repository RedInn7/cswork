import hashlib,json,tempfile,unittest
from pathlib import Path
from generate_batch import build,result_settings
from result_contract import compare_batch,compare_output,validate_result,MAX_ROWS
from verify import snapshot_inputs

class SemanticIntegrationTests(unittest.TestCase):
 def test_batch_accepts_alternatives_and_rejects_missing_input(self):
  self.assertTrue(compare_batch('"aba"\n',['bab'],'string','jsonl-v1',5,[['babad']]))
  self.assertFalse(compare_batch('"aba"\n',['bab'],'string','jsonl-v1',5,[['bab']]))
  self.assertFalse(compare_batch('"aba"\n',['bab'],'string','jsonl-v1',5))
  self.assertTrue(compare_output('semantic-lc-5','aba\n','bab\n','["babad"]'))
  self.assertFalse(compare_output('semantic-lc-5','aba\n','bab\n'))
  self.assertEqual(result_settings({'semanticId':162,'resultKind':'integer'}),('integer','jsonl-v1','semantic-lc-162'))
  for spec in ({'semanticId':5,'resultKind':'integer'},{'semanticId':5,'resultKind':'string','checker':'exact'},{'semanticId':999,'resultKind':'string'}):
   with self.assertRaises(ValueError):result_settings(spec)
 def test_manifest_identity_and_sidecar_binding(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);folder=root/'group'/'0005.Authored';folder.mkdir(parents=True)
   (folder/'Solution.py').write_text('class Solution:\n def solve(self,s):return "aba"\n')
   spec=dict(method='solve',semanticId=5,resultKind='string',titleZh='回文',titleEn='Palindrome',descriptionZh='回文',descriptionEn='Palindrome',inputZh='JSON',inputEn='JSON',outputZh='字符串',outputEn='String',edges=[['babad']],pressure=[(['babad'],'bab')],validate=lambda a:True,oracle=lambda a:'bab',random_args=lambda r:['babad'],encode=json.dumps,parse='args=json.load(sys.stdin)',mutants=[{'name':'wrong','source':'print("bad")'}])
   origin=dict(signature={'name':'solve'},difficulty='中等',sourceUrl='https://example.test/zh',sourceEnUrl='https://example.test/en')
   item=build(5,spec,{5:origin},root,root)
   hashes=root/'hashes.json';hashes.write_text(json.dumps({'lc-5':'a'*64}));manifest=root/'manifest.json';manifest.write_text(json.dumps({'problems':[item]}))
   _,prepared=snapshot_inputs(root,hashes);self.assertEqual(prepared[0][0]['semanticId'],5)
   for field,value in [('semanticId',1044),('checker','exact'),('resultKind','integer'),('id','lc-1044')]:
    altered={**item,field:value};manifest.write_text(json.dumps({'problems':[altered]}))
    with self.assertRaises((ValueError,FileNotFoundError)):snapshot_inputs(root,hashes)
   manifest.write_text(json.dumps({'problems':[item]}))
   oraclepath=root/'lc-5.oracle.json';oracle=json.loads(oraclepath.read_text());oracle['semanticId']=1044;raw=json.dumps(oracle).encode();oraclepath.write_bytes(raw);item['oracleSha256']=hashlib.sha256(raw).hexdigest();manifest.write_text(json.dumps({'problems':[item]}))
   with self.assertRaisesRegex(ValueError,'Semantic metadata'):snapshot_inputs(root,hashes)
 def test_row_budget_is_separate_from_flat_arrays(self):
  self.assertEqual(MAX_ROWS,4_000_000)
  value=[[]]*1_000_001;validate_result('integer-rows',value)
  with self.assertRaises(ValueError):validate_result('integer-array',[0]*1_000_001)
