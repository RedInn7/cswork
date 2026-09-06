"""Framework tests use authored toy algorithms, never execute downloaded solutions."""
import unittest
import contextlib
import io
import json
import hashlib
import tempfile
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import generate_batch
import coverage
from generate_batch import integer, checked_args, answer, wrapper

class BatchTests(unittest.TestCase):
    def test_secondary_reference_requires_explicit_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with self.assertRaisesRegex(ValueError,'secondary reference directory'):
                generate_batch.reference_source(root,1416)
            with self.assertRaises(FileNotFoundError):generate_batch.reference_source(root,1416,root)
            p=root/'restore-the-array.py';p.write_text('class Solution: pass\n')
            self.assertEqual(generate_batch.reference_source(root,1416,root),(p,p.read_text()))

    def test_source_metadata_controls_identity_and_difficulty(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'group'/'0001.Fixture';folder.mkdir(parents=True)
            (folder/'Solution.py').write_text('class Solution:\n    def solve(self,x): return x\n')
            spec=dict(method='solve',difficulty='简单',titleZh='测试',titleEn='Fixture',
                descriptionZh='测试',descriptionEn='Fixture',inputZh='整数',inputEn='Integer',
                outputZh='整数',outputEn='Integer',edges=[[1]],pressure=[([2],2)],
                validate=lambda a: True,oracle=lambda a:a[0],random_args=lambda r:[1],
                encode=lambda a:str(a[0])+'\n',parse='args=[1]',mutants=[{'name':'wrong','source':'print(0)'}])
            origin=dict(signature={'name':'other'},difficulty='困难',sourceUrl='https://example.test/zh',sourceEnUrl='https://example.test/en')
            with self.assertRaisesRegex(ValueError,'method does not match'):
                generate_batch.build(1,spec,{1:origin},root,root)
            origin['signature']['name']='solve '
            item=generate_batch.build(1,spec,{1:origin},root,root)
            self.assertEqual(item['oracleSha256'],hashlib.sha256((root/'lc-1.oracle.json').read_bytes()).hexdigest())
            self.assertEqual(json.loads((root/'lc-1.candidate.json').read_text())['problem']['difficulty'],'困难')

    def test_scalar_contract(self):
        self.assertEqual(integer(True),1)
        for bad in (1.0,'1',None,[],{}):
            with self.assertRaises(ValueError): integer(bad)
    def test_oracle_does_not_mutate_original_case(self):
        original=[[3,1,2]]
        def oracle(a):
            a[0].sort()
            return a[0][0]
        spec={'validate':lambda a: len(a)==1,'oracle':oracle}
        self.assertEqual(answer(spec,original),1)
        self.assertEqual(original,[[3,1,2]])
        with self.assertRaises(ValueError):checked_args({'validate':lambda a:False},original)
        with self.assertRaises(ValueError):checked_args({'validate':lambda a:0},original)
        with self.assertRaises(ValueError):checked_args({'validate':lambda a:None},[float('nan')])
        self.assertEqual(checked_args({'validate':lambda a:None},original),original)
    def test_reference_wrapper_has_explicit_method_and_scalar_output(self):
        value=wrapper({'method':'solve','parse':'args=[int(sys.stdin.read())]'},'class Solution:\n    def solve(self,x): return x')
        compile(value,'authored-fixture','exec')
        self.assertIn('Solution().solve(*args)',value)
        self.assertIn('type(result) not in (int, bool)',value)
        with self.assertRaises(ValueError):wrapper({'method':'solve();evil','parse':''},'')



class ManifestBoundaryTests(unittest.TestCase):
    def test_generation_failures_remove_previous_trust_files(self):
        for failure in ('missing-library','unknown-subset','mid-generation'):
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as directory:
                root=Path(directory);out=root/'out';out.mkdir()
                for name in ('manifest.json','verified-manifest.json','verification-report.json'):
                    (out/name).write_text('old success')
                library=root/'library.jsonl'
                if failure!='missing-library':
                    library.write_text(json.dumps(dict(id='lc-1',number=1))+'\n'+json.dumps(dict(id='lc-2',number=2))+'\n')
                argv=['generate_batch.py','--batch','dp','--library',str(library),'--references',str(root),'--out',str(out)]
                if failure=='unknown-subset':argv+=['--ids','99']
                module=SimpleNamespace(PROBLEMS={1:{},2:{}})
                def build(pid,*args):
                    if pid==2:raise ValueError('generation failed')
                    return {'id':'lc-1','formalCases':26}
                with patch.object(sys,'argv',argv),patch.object(generate_batch.importlib,'import_module',return_value=module),patch.object(generate_batch,'build',side_effect=build),contextlib.redirect_stdout(io.StringIO()):
                    with self.assertRaises((ValueError,FileNotFoundError)):generate_batch.main()
                for name in ('manifest.json','verified-manifest.json','verification-report.json'):
                    self.assertFalse((out/name).exists())

    def test_reference_override_is_explicit_and_never_falls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'group'/'1971.Find if Path Exists in Graph';folder.mkdir(parents=True)
            (folder/'Solution.py').write_text('broken original')
            with self.assertRaises(ValueError):generate_batch.reference_source(root,1971)
            (folder/'Solution2.py').write_text('reviewed alternative')
            path,source=generate_batch.reference_source(root,1971)
            self.assertEqual(path.name,'Solution2.py');self.assertEqual(source,'reviewed alternative')

    def test_operator_dependencies_available_in_authored_wrapper(self):
        # This toy program is authored here; no downloaded source is executed.
        source='class Solution:\n    def solve(self,a): return reduce(xor,a)\n'
        code=wrapper({'method':'solve','parse':'args=[[1,2,1]]'},source)
        output=io.StringIO()
        with patch.object(sys,'argv',['fixture']),contextlib.redirect_stdout(output):exec(code,{'__name__':'__main__'})
        self.assertEqual(output.getvalue(),'2\n')

    def test_modular_pow_keeps_builtin_semantics(self):
        source='class Solution:\n    def solve(self,n): return pow(5,n,17)\n'
        code=wrapper({'method':'solve','parse':'args=[100]'},source)
        output=io.StringIO()
        with patch.object(sys,'argv',['fixture']),contextlib.redirect_stdout(output):exec(code,{'__name__':'__main__'})
        self.assertEqual(output.getvalue(),str(pow(5,100,17))+'\n')

    def make_verification(self,root):
        digest='a'*64
        raw=json.dumps({'problem':{'id':'lc-1'},'cases':[{},{}]}).encode()
        package_hash=hashlib.sha256(raw).hexdigest()
        (root/'lc-1.json').write_bytes(raw)
        counts={'formal':2,'oracle':120,'negativeControls':2}
        item=dict(problemId='lc-1',packageFile='lc-1.json',verified=True,counts=counts,
            sourceContentHash=digest,packageSha256=package_hash,referenceSha256=digest,runnerSha256=digest,
            inputBytesSha256=package_hash,referenceBytesSha256=digest,oracleSha256=digest,mutationSha256=digest)
        entry=dict(id='lc-1',status='verified',counts=counts,checks=[{'passed':True} for _ in range(5)],
            sourceContentHash=digest,packageSha256=package_hash,referenceSha256=digest,wrapperSha256=digest,
            inputBytesSha256=package_hash,referenceBytesSha256=digest,oracleSha256=digest,mutationSha256=digest)
        manifest={'verifiedAt':'now','sourceHashesFileSha256':digest,'problems':[item]}
        report={'allPassed':True,'engine':'go-judge','finishedAt':'now','sourceHashesFileSha256':digest,'problems':[entry]}
        path=root/'verified-manifest.json'
        path.write_text(json.dumps(manifest));(root/'verification-report.json').write_text(json.dumps(report))
        return path,manifest,report

    def test_coverage_requires_complete_consistent_verification(self):
        for fault in ('none','missing-hash','unknown-id','duplicate','traversal','failed-report','incomplete-checks','different-report-bytes','wrong-count','wrong-package-id'):
            with self.subTest(fault=fault),tempfile.TemporaryDirectory() as directory:
                root=Path(directory);path,manifest,report=self.make_verification(root)
                hashes={'lc-1':'a'*64};allowed={'lc-1'}
                if fault=='missing-hash':hashes={}
                if fault=='unknown-id':allowed=set()
                if fault=='duplicate':manifest['problems']*=2
                if fault=='traversal':manifest['problems'][0]['packageFile']='../lc-1.json'
                if fault=='failed-report':report['allPassed']=False
                if fault=='incomplete-checks':report['problems'][0]['checks'].pop()
                if fault=='different-report-bytes':report['problems'][0]['oracleSha256']='b'*64
                if fault=='wrong-count':manifest['problems'][0]['counts']['formal']=3
                if fault=='wrong-package-id':
                    raw=json.dumps({'problem':{'id':'lc-2'},'cases':[{},{}]}).encode()
                    (root/'lc-1.json').write_bytes(raw)
                    manifest['problems'][0]['packageSha256']=hashlib.sha256(raw).hexdigest()
                path.write_text(json.dumps(manifest));(root/'verification-report.json').write_text(json.dumps(report))
                if fault=='none':self.assertEqual(coverage.verified_records(path,hashes,allowed),{'lc-1'})
                else:
                    with self.assertRaises(ValueError):coverage.verified_records(path,hashes,allowed)

    def test_failed_coverage_refresh_removes_stale_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);output=root/'coverage.json';output.write_text('old success')
            argv=['coverage.py','--library',str(root/'missing'),'--source-hashes',str(root/'hashes'),'--output',str(output)]
            with patch.object(sys,'argv',argv),self.assertRaises(FileNotFoundError):coverage.main()
            self.assertFalse(output.exists())




class TypedBatchTests(unittest.TestCase):
    def test_authored_wrappers_emit_jsonl_records_and_counted_formal_output(self):
        for kind,value,formal in [('string','a b','a b\n'),
                ('integer-array',[1,2,1],'3\n1 2 1\n'),
                ('integer-set',[2,1],'2\n2 1\n'),
                ('string-set',['','a b'],'2\n\na b\n')]:
            with self.subTest(kind=kind):
                spec={'method':'solve','resultKind':kind,'parse':'args=json.loads(sys.stdin.read())'}
                code=wrapper(spec,'class Solution:\n    def solve(self,x): return x\n')
                for batch in (False,True):
                    output=io.StringIO()
                    stdin=json.dumps([[value],[value]] if batch else [value])
                    with patch.object(sys,'argv',['fixture']+(['--batch'] if batch else [])),patch.object(sys,'stdin',io.StringIO(stdin)),contextlib.redirect_stdout(output):
                        exec(code,{'__name__':'__main__'})
                    if batch:self.assertEqual([json.loads(line) for line in output.getvalue().splitlines()],[value,value])
                    else:self.assertEqual(output.getvalue(),formal)
        with self.assertRaises(ValueError):generate_batch.result_settings({'resultKind':'string','oracleEncoding':'legacy-integer'})
        with self.assertRaises(ValueError):generate_batch.result_settings({'resultKind':'integer-set','checker':'tokens'})

    def test_typed_package_generation_is_bound_to_snapshot_and_output_limit(self):
        import verify
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'group'/'0001.Fixture';folder.mkdir(parents=True)
            (folder/'Solution.py').write_text('class Solution:\n    def solve(self,x): return x\n')
            spec=dict(method='solve',resultKind='integer-array',titleZh='测试',titleEn='Fixture',
                descriptionZh='测试',descriptionEn='Fixture',inputZh='数组',inputEn='Array',
                outputZh='数组',outputEn='Array',edges=[[[1,2]]],pressure=[([[3]],[3])],
                validate=lambda a:True,oracle=lambda a:a[0],random_args=lambda r:[[1,2]],
                encode=lambda a:json.dumps(a)+'\n',parse='args=json.loads(sys.stdin.read())',
                mutants=[{'name':'wrong','source':'print(0)'}],outputLimit=1)
            origin=dict(signature={'name':'solve'},difficulty='简单',sourceUrl='https://example.test/zh',sourceEnUrl='https://example.test/en')
            item=generate_batch.build(1,spec,{1:origin},root,root)
            (root/'manifest.json').write_text(json.dumps({'problems':[item]}))
            hashes=root/'hashes.json';hashes.write_text(json.dumps({'lc-1':'a'*64}))
            _,prepared=verify.snapshot_inputs(root,hashes)
            self.assertEqual(prepared[0][0]['resultKind'],'integer-array')
            self.assertEqual(prepared[0][0]['resourceLimits']['outputLimit'],1)
            self.assertEqual(prepared[0][0]['oracleEncoding'],'jsonl-v1')
            opath=root/'lc-1.oracle.json';oracle=json.loads(opath.read_text())
            original_raw=opath.read_bytes()
            self.assertEqual(item['oracleSha256'],hashlib.sha256(original_raw).hexdigest())
            self.assertEqual(oracle['resultKind'],'integer-array')
            self.assertEqual(oracle['oracleEncoding'],'jsonl-v1')
            for change in ('missing-kind','wrong-kind','bool-element','missing-record'):
                bad=json.loads(json.dumps(oracle))
                if change=='missing-kind':del bad['resultKind']
                if change=='wrong-kind':bad['resultKind']='integer-set'
                if change=='bool-element':bad['expected'][0]=[True]
                if change=='missing-record':bad['expected'].pop()
                opath.write_text(json.dumps(bad))
                # Rebind to reach metadata/type checks rather than fail at byte integrity.
                item['oracleSha256']=hashlib.sha256(opath.read_bytes()).hexdigest()
                (root/'manifest.json').write_text(json.dumps({'problems':[item]}))
                with self.subTest(change=change),self.assertRaises(ValueError):verify.snapshot_inputs(root,hashes)
            opath.write_bytes(original_raw)
            too_large={**spec,'resultKind':'string','oracle':lambda a:'a'*1025,'pressure':[([[1]],'a'*1025)]}
            with self.assertRaisesRegex(ValueError,'output limit'):generate_batch.build(1,too_large,{1:origin},root,root)




    def test_coverage_binds_typed_oracle_sidecar_and_runtime_contract(self):
        for fault in ('none','wrong-kind','missing-metadata','changed-oracle','bool-element','short-oracle','changed-limit'):
            with self.subTest(fault=fault),tempfile.TemporaryDirectory() as directory:
                root=Path(directory);path,manifest,report=ManifestBoundaryTests().make_verification(root)
                item=manifest['problems'][0];entry=report['problems'][0]
                limits={'timeLimit':2,'memoryLimit':262144,'outputLimit':64}
                oracle={'args':[[1]]*120,'expected':[[1]]*120,'resultKind':'integer-array','oracleEncoding':'jsonl-v1'}
                package={'problem':{'id':'lc-1','checker':'tokens',**limits},'cases':[{'expectedOutput':'1\n1\n'}]*2}
                raw=json.dumps(package).encode();(root/'lc-1.json').write_bytes(raw)
                for record in (item,entry):
                    record.update(resultKind='integer-array',oracleEncoding='jsonl-v1',checker='tokens',resourceLimits=limits.copy())
                    record['packageSha256']=record['inputBytesSha256']=hashlib.sha256(raw).hexdigest()
                if fault=='wrong-kind':item['resultKind']=entry['resultKind']='integer'
                if fault=='missing-metadata':del item['oracleEncoding']
                if fault=='bool-element':oracle['expected'][0]=[True]
                if fault=='short-oracle':oracle['expected'].pop()
                if fault=='changed-limit':
                    for record in (item,entry):record['resourceLimits']['outputLimit']=128
                oracle_raw=json.dumps(oracle).encode();(root/'lc-1.oracle.json').write_bytes(oracle_raw)
                item['oracleSha256']=entry['oracleSha256']=hashlib.sha256(oracle_raw).hexdigest()
                if fault=='changed-oracle':(root/'lc-1.oracle.json').write_bytes(oracle_raw+b' ')
                path.write_text(json.dumps(manifest));(root/'verification-report.json').write_text(json.dumps(report))
                if fault=='none':self.assertEqual(coverage.verified_records(path,{'lc-1':'a'*64},{'lc-1'}),{'lc-1'})
                else:
                    with self.assertRaises(ValueError):coverage.verified_records(path,{'lc-1':'a'*64},{'lc-1'})

if __name__=='__main__':unittest.main()
