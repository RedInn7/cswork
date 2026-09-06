"""Provenance/integrity regression tests; no sandbox or reference execution."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from verify import assert_unchanged, snapshot_inputs, check_mutation

class ProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data = Path(self.temp.name)
        self.hashes = self.data / 'source-hashes.json'
        self.hashes.write_text(json.dumps({'lc-3': 'a' * 64}))
        raw = json.dumps({'cases': [{'name': str(i), 'input':'1\n', 'expectedOutput':'1\n'} for i in range(2)]}).encode()
        ref = b'# never executed\n'
        mutants = b'[{"name":"wrong algorithm","source":"print(0)"}]'
        (self.data / 'lc-3.candidate.json').write_bytes(raw)
        (self.data / 'lc-3.reference.py').write_bytes(ref)
        (self.data / 'lc-3.oracle.json').write_text(json.dumps({'args':[['a']]*120,'expected':[1]*120}))
        (self.data / 'lc-3.mutants.json').write_bytes(mutants)
        (self.data / 'manifest.json').write_text(json.dumps({'problems': [{
            'id': 'lc-3', 'packageSha256': hashlib.sha256(raw).hexdigest(),
            'wrapperSha256': hashlib.sha256(ref).hexdigest(),
            'mutantsSha256': hashlib.sha256(mutants).hexdigest(),
            'formalCases':2, 'oracleCases':120}]}))

    def test_legacy_oracle_hash_is_optional_but_declared_hash_is_strict(self):
        snapshot_inputs(self.data,self.hashes)
        path=self.data/'manifest.json'
        manifest=json.loads(path.read_text())
        digest=hashlib.sha256((self.data/'lc-3.oracle.json').read_bytes()).hexdigest()
        manifest['problems'][0]['oracleSha256']=digest
        path.write_text(json.dumps(manifest))
        snapshot_inputs(self.data,self.hashes)
        for value in (None,False,'a'*63,'z'*64,'b'*64):
            manifest['problems'][0]['oracleSha256']=value
            path.write_text(json.dumps(manifest))
            with self.subTest(value=value),self.assertRaisesRegex(ValueError,'Oracle bytes'):
                snapshot_inputs(self.data,self.hashes)

    def test_jsonl_requires_generation_hash_and_rejects_preverification_tampering(self):
        path=self.data/'manifest.json';opath=self.data/'lc-3.oracle.json'
        manifest=json.loads(path.read_text());item=manifest['problems'][0]
        item.update(resultKind='integer',oracleEncoding='jsonl-v1')
        oracle=json.loads(opath.read_text())
        oracle.update(resultKind='integer',oracleEncoding='jsonl-v1')
        opath.write_text(json.dumps(oracle))
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError,'requires generation-time'):
            snapshot_inputs(self.data,self.hashes)
        item['oracleSha256']=hashlib.sha256(opath.read_bytes()).hexdigest()
        path.write_text(json.dumps(manifest))
        snapshot_inputs(self.data,self.hashes)
        oracle['expected'][0]=2
        opath.write_text(json.dumps(oracle))
        with self.assertRaisesRegex(ValueError,'Oracle bytes'):
            snapshot_inputs(self.data,self.hashes)

    def test_source_hash_is_required_and_strict(self):
        for value in [{}, {'lc-3':'a'*63}, {'lc-3':'z'*64}, {'lc-3':None}]:
            self.hashes.write_text(json.dumps(value))
            with self.assertRaises(ValueError):
                snapshot_inputs(self.data, self.hashes)

    def test_startup_byte_mismatch_fails(self):
        (self.data / 'lc-3.reference.py').write_text('tampered')
        with self.assertRaises(ValueError):
            snapshot_inputs(self.data, self.hashes)

    def test_finish_checks_all_frozen_inputs(self):
        for name in ['source-hashes.json', 'manifest.json', 'lc-3.candidate.json',
                     'lc-3.reference.py', 'lc-3.oracle.json', 'lc-3.mutants.json']:
            with self.subTest(name=name):
                snapshots, prepared = snapshot_inputs(self.data, self.hashes)
                self.assertEqual(prepared[0][0]['sourceContentHash'], 'a'*64)
                assert_unchanged(snapshots)
                path = self.data / name
                raw = path.read_bytes()
                path.write_bytes(raw + b'\n')
                with self.assertRaises(ValueError):
                    assert_unchanged(snapshots)
                path.write_bytes(raw)

    def test_oracle_cannot_be_empty_short_mismatched_or_overstated(self):
        for args, expected in [([], []), ([[]]*119, [0]*119), ([[]]*120, []),
                               ([[]]*121, [0]*121)]:
            with self.subTest(lengths=(len(args),len(expected))):
                (self.data / 'lc-3.oracle.json').write_text(json.dumps({'args':args,'expected':expected}))
                with self.assertRaises(ValueError):
                    snapshot_inputs(self.data, self.hashes)

    def test_formal_actual_count_must_match(self):
        path = self.data / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['problems'][0]['formalCases'] = 3
        path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            snapshot_inputs(self.data, self.hashes)

    def test_mutation_bytes_must_match(self):
        (self.data / 'lc-3.mutants.json').write_text('[]')
        with self.assertRaises(ValueError):
            snapshot_inputs(self.data, self.hashes)

    def test_counts_are_actual_and_mutations_are_bound(self):
        _, prepared = snapshot_inputs(self.data, self.hashes)
        entry = prepared[0][0]
        self.assertEqual(entry['counts'], {'formal':2,'oracle':120,'negativeControls':2})
        self.assertEqual(entry['mutationSha256'], hashlib.sha256((self.data/'lc-3.mutants.json').read_bytes()).hexdigest())

    def test_mutation_requires_clean_wrong_answer(self):
        mutant = {'name':'off by one','source':'print(2)'}
        cases = [{'name':'sample','input':'','expectedOutput':'1'}]
        for result, passed in [({'status':'Runtime Error'},False),
                               ({'status':'Accepted','files':{'stdout':'1'}},False),
                               ({'status':'Accepted','files':{'stdout':'2'}},True)]:
            check = check_mutation(mutant, cases, lambda *_: result)
            self.assertEqual(check['passed'], passed)
            self.assertEqual(check['attempts'][0]['case'], 'sample')

    def test_mutation_tries_later_cases_before_declaring_survival(self):
        cases = [{'name':str(i),'input':str(i),'expectedOutput':str(i)} for i in range(2)]
        calls = []
        def runner(_, stdin):
            calls.append(stdin)
            return {'status':'Accepted','files':{'stdout':'0'}}
        self.assertTrue(check_mutation({'name':'bad','source':'print(0)'}, cases, runner)['passed'])
        self.assertEqual(calls, ['0','1'])

if __name__ == '__main__':
    unittest.main()
