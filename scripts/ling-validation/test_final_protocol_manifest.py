"""Synthetic packages exercise generator/verification metadata without a runner."""
import hashlib,json,tempfile,unittest
from pathlib import Path
from generate_batch import build
from verify import snapshot_inputs

class FinalProtocolManifest(unittest.TestCase):
 def test_fixed_metadata_binds_package_oracle_and_manifest(self):
  fixtures=[(49,'stringStructureId','json-string-rows',[['a']],[['a']]),(142,'specialId','integer',[[1],0],0),(1095,'auxiliaryId','integer',[1,[1,2,1]],0),(380,'complexDesignId','string',[['RandomizedSet','insert','getRandom'],[[],[1],[]]],'[null,1,1]'),(297,'complexDesignId','string',[['Codec','roundTrip'],[[],[[1]]]],'[null,[1]]'),(449,'complexDesignId','string',[['Codec','roundTrip'],[[],[[1]]]],'[null,[1]]')]
  for pid,field,kind,args,value in fixtures:
   with self.subTest(pid=pid),tempfile.TemporaryDirectory() as directory:
    root=Path(directory);folder=root/'group'/f'{pid:04d}.Authored';folder.mkdir(parents=True)
    source='class Solution:\n def solve(self,*args):return 0\n'
    signature={'name':'solve'}
    if pid==380:
     source='class RandomizedSet:\n pass\n';signature={'systemdesign':True,'classname':'RandomizedSet','methods':[{'name':m} for m in ('insert','remove','getRandom')]}
    if pid in (297,449):
     source='class Codec:\n pass\n';signature={'name':'Codec' if pid==297 else 'CodecDriver','params':[{'name':'root','type':'TreeNode'}],'return':{'type':'string' if pid==297 else 'TreeNode'},'manual':True}
    (folder/'Solution.py').write_text(source)
    spec=dict(method='solve',resultKind=kind,titleZh='测试',titleEn='Fixture',descriptionZh='测试',descriptionEn='Fixture',inputZh='JSON',inputEn='JSON',outputZh='结果',outputEn='Result',edges=[args],pressure=[(args,value)],validate=lambda a:True,oracle=lambda a:value,random_args=lambda r:args,encode=json.dumps,parse='args=json.load(sys.stdin)',mutants=[dict(name='bad',source='print(99)')],**{field:pid})
    origin=dict(signature=signature,difficulty='中等',sourceUrl='https://example.test/zh',sourceEnUrl='https://example.test/en')
    item=build(pid,spec,{pid:origin},root,root)
    hashes=root/'hashes.json';hashes.write_text(json.dumps({f'lc-{pid}':'a'*64}));manifest=root/'manifest.json';manifest.write_text(json.dumps({'problems':[item]}))
    _,prepared=snapshot_inputs(root,hashes);self.assertEqual(prepared[0][0][field],pid)
    for location in ('manifest','oracle','package'):
     manifest.write_text(json.dumps({'problems':[item]}));changed=dict(item)
     if location=='manifest':changed[field]=999
     else:
      path=root/f'lc-{pid}.{"oracle" if location=="oracle" else "candidate"}.json';before=path.read_bytes();obj=json.loads(before)
      if location=='oracle':obj[field]=999
      else:obj['problem'][field]=999
      raw=json.dumps(obj).encode();path.write_bytes(raw);changed['oracleSha256' if location=='oracle' else 'packageSha256']=hashlib.sha256(raw).hexdigest()
     manifest.write_text(json.dumps({'problems':[changed]}))
     with self.assertRaises(ValueError):snapshot_inputs(root,hashes)
     if location!='manifest':path.write_bytes(before)
