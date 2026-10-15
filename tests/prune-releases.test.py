import os
import subprocess
import tempfile
import unittest
from pathlib import Path

script = Path(__file__).resolve().parent.parent / "deploy/prune-releases.sh"
A, B, C, D = ("a" * 40, "b" * 40, "c" * 40, "d" * 40)


class PruneReleases(unittest.TestCase):
    def run_prune(self, root, *args):
        env = {**os.environ, "CSWORK_RELEASES": str(root / "releases"), "CSWORK_CURRENT": str(root / "current")}
        return subprocess.run(["bash", str(script), *args], env=env, capture_output=True, text=True)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        releases = self.root / "releases"
        for sha in (A, B, C, D):
            (releases / sha).mkdir(parents=True)
            (releases / sha / "REVISION").write_text(sha)
        (releases / "hand-made").mkdir()
        (releases / ("e" * 40)).symlink_to(releases / A)
        (self.root / "current").symlink_to(releases / C)

    def tearDown(self):
        self.tmp.cleanup()

    def left(self):
        return sorted(p.name for p in (self.root / "releases").iterdir())

    def test_keeps_only_live_and_rollback(self):
        result = self.run_prune(self.root, str(self.root / "releases" / B))
        self.assertEqual(result.returncode, 0, result.stderr)
        # Live (C) and rollback (B) stay; A and D go; non-sha entries and links are never touched.
        self.assertEqual(self.left(), sorted([B, C, "e" * 40, "hand-made"]))
        self.assertIn(f"pruned release {A}", result.stdout)

    def test_without_rollback_keeps_the_live_release(self):
        self.assertEqual(self.run_prune(self.root).returncode, 0)
        self.assertEqual(self.left(), sorted([C, "e" * 40, "hand-made"]))

    def test_rollback_equal_to_live_deletes_nothing(self):
        # install.sh re-run on the live SHA: previous == target == live.
        result = self.run_prune(self.root, str(self.root / "current"))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(len(self.left()), 6)

    def test_live_release_outside_releases_deletes_nothing(self):
        outside = self.root / "elsewhere"
        outside.mkdir()
        (self.root / "current").unlink()
        (self.root / "current").symlink_to(outside)
        self.assertEqual(self.run_prune(self.root).returncode, 0)
        self.assertEqual(len(self.left()), 6)

    def test_no_live_release_deletes_nothing(self):
        (self.root / "current").unlink()
        result = self.run_prune(self.root, str(self.root / "releases" / B))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(len(self.left()), 6)


if __name__ == "__main__":
    unittest.main()
