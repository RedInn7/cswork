"""Regression tests for local authoring only; this is not sandbox evidence."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

RUNNER = Path(__file__).resolve().parents[1] / 'scripts/oa-judge/local_batch_runner.py'
spec = importlib.util.spec_from_file_location('oa_local_runner', RUNNER)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class LocalRunnerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.program = Path(self.directory.name) / 'authored.py'

    def write(self, source):
        self.program.write_text(source, encoding='utf-8')

    def test_fresh_globals_utf8_buffers_and_stderr(self):
        self.write("import sys\nassert __name__ == '__main__'\nassert 'seen' not in globals()\nseen = True\nassert len(sys.argv) == 1\nsys.stderr.write('diagnostic')\nsys.stdout.buffer.write(sys.stdin.buffer.read())\n")
        saved = sys.stdin, sys.stdout, sys.stderr, sys.argv
        for value in ['中文\n', 'second\n', '']:
            self.assertEqual(runner.run_case(self.program, value), value)
            self.assertEqual((sys.stdin, sys.stdout, sys.stderr, sys.argv), saved)

    def test_failures_restore_streams(self):
        saved = sys.stdin, sys.stdout, sys.stderr, sys.argv
        for source in ['raise ValueError("broken")', 'raise SystemExit(2)', 'raise SystemExit("failure")']:
            self.write(source)
            with self.assertRaises(RuntimeError):
                runner.run_case(self.program, '')
            self.assertEqual((sys.stdin, sys.stdout, sys.stderr, sys.argv), saved)

    def test_successful_exit(self):
        for exit_value in ['0', 'None']:
            self.write(f'print("done")\nraise SystemExit({exit_value})')
            self.assertEqual(runner.run_case(self.program, ''), 'done\n')

    def test_cli_protocol_and_invalid_payload(self):
        self.write('import sys\nprint(sys.stdin.read(), end="")')
        for payload, success in [(['甲', '乙'], True), ({'input': 'x'}, False), (['x', 1], False)]:
            result = subprocess.run([sys.executable, '-I', str(RUNNER), str(self.program)], input=json.dumps(payload), text=True, capture_output=True, timeout=30)
            self.assertEqual(result.returncode == 0, success)
            if success:
                self.assertEqual(json.loads(result.stdout), payload)


if __name__ == '__main__':
    unittest.main()
