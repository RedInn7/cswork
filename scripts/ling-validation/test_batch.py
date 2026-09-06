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

if __name__=='__main__':unittest.main()
