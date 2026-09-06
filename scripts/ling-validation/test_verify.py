"""Provenance/integrity regression tests; no sandbox or reference execution."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from verify import assert_unchanged, snapshot_inputs

class ProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data = Path(self.temp.name)
        self.hashes = self.data / 'source-hashes.json'
        self.hashes.write_text(json.dumps({'lc-3': 'a' * 64}))
        raw = b'{"cases":[]}'
        ref = b'# never executed\n'
        (self.data / 'lc-3.candidate.json').write_bytes(raw)
        (self.data / 'lc-3.reference.py').write_bytes(ref)
        (self.data / 'lc-3.oracle.json').write_text('{"args":[],"expected":[]}')
        (self.data / 'manifest.json').write_text(json.dumps({'problems': [{
            'id': 'lc-3', 'packageSha256': hashlib.sha256(raw).hexdigest(),
            'wrapperSha256': hashlib.sha256(ref).hexdigest()}]}))

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
                     'lc-3.reference.py', 'lc-3.oracle.json']:
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

if __name__ == '__main__':
    unittest.main()
