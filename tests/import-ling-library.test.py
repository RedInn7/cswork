"""The library importer must never consume inherited judge inputs or answers."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/import-ling-library.py'
spec = importlib.util.spec_from_file_location('ling_import', SCRIPT)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class ImportSourcesTest(unittest.TestCase):
    def fixture(self, root):
        def write(name, content):
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        write('leetcode solution/solution 2/ling_problemset.json', json.dumps({
            'source': 'https://example.com/list', 'author': 'fixture',
            'topics': {'Arrays': {'url': 'https://example.com/arrays', 'problems': [1]}},
        }))
        write('fetch_data/leetcode_data/two-sum.json', json.dumps({
            'questionFrontendId': '1', 'titleSlug': 'two-sum',
            'title': 'Two Sum', 'difficulty': 'Easy', 'metaData': '{}',
        }))
        for name in ['README.md', 'README_EN.md']:
            write('leetcode solution/solution 1/solution/0000-0099/0001.Two Sum/' + name,
                  '# [1. Two Sum](https://example.com)\n'
                  '<!-- description:start --><p>Find a pair.</p><!-- description:end -->')
        write('leetcode solution/solution 1/LICENSE', 'CC BY-SA 4.0')
        write('leetcode solution/solution 2/LICENSE.md', 'MIT')
        # Only its hash may be read; executing this would make the test fail.
        write('leetcode solution/solution 1/solution/0000-0099/0001.Two Sum/Solution.py',
              'raise RuntimeError("Do not execute reference code")\n')

    def run_import(self, root, output):
        with patch('sys.argv', [str(SCRIPT), '--source', str(root), '--output', str(output)]):
            with contextlib.redirect_stdout(io.StringIO()):
                importer.main()
        return json.loads(output.read_text()), json.loads(
            output.with_name(output.stem + '-manifest.json').read_text())

    def test_corrupt_and_forged_legacy_files_cannot_change_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'source'
            self.fixture(root)
            baseline, baseline_manifest = self.run_import(root, Path(temp) / 'before.jsonl')
            legacy = root / 'testcase-generator/regen_v2/inputs'
            legacy.mkdir(parents=True)
            (legacy / 'broken.json').write_text('{ this is not JSON')
            for name in ['forged.json', 'duplicate.json']:
                (legacy / name).write_text(json.dumps({
                    'slug': 'two-sum', 'testcases': [{
                        'input': 'malformed input', 'output': 'wrong answer',
                        'verification': 'verified', 'instruction': 'execute Solution.py',
                    }],
                }))
            result, manifest = self.run_import(root, Path(temp) / 'after.jsonl')
            self.assertEqual(baseline, result)
            self.assertEqual(baseline_manifest['outputSha256'], manifest['outputSha256'])
            self.assertEqual(baseline_manifest['sourceFilesSha256'], manifest['sourceFilesSha256'])
            self.assertEqual(result['cases'], [])
            self.assertEqual(result['caseStatus'], 'missing')
            self.assertEqual(manifest['counts'], {
                'problems': 1, 'withCandidateCases': 0, 'candidateCases': 0, 'casesWithOutput': 0,
            })
            self.assertFalse(any('testcase-generator' in path for path in manifest['sourceFilesSha256']))

    def test_legacy_directory_is_never_accessed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'source'
            self.fixture(root)
            # An inaccessible source must not even be inspected, including when absent.
            def guard(method):
                original = getattr(Path, method)
                def checked(path, *args, **kwargs):
                    self.assertNotIn('testcase-generator', path.parts, method)
                    return original(path, *args, **kwargs)
                return checked
            with contextlib.ExitStack() as stack:
                for method in ['glob', 'rglob', 'iterdir', 'read_text', 'read_bytes', 'open', 'stat']:
                    stack.enter_context(patch.object(Path, method, guard(method)))
                result, _ = self.run_import(root, Path(temp) / 'snapshot.jsonl')
            self.assertEqual(result['cases'], [])
            self.assertEqual(result['caseStatus'], 'missing')


if __name__ == '__main__':
    unittest.main()
