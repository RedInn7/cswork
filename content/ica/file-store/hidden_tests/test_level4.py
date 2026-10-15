import unittest

from src.files import FileStore


class Level4Hidden(unittest.TestCase):
    def setUp(self):
        self.store = FileStore()
        self.store.add_user(1, 'a', 100)
        self.store.add_user(2, 'b', 100)
        self.store.add_as(3, 'a', '/a/x', 40)
        self.store.add_as(4, 'b', '/b/y', 9)

    def test_compress_only_own_files(self):
        self.assertIsNone(self.store.compress(10, 'b', '/a/x'))
        self.assertIsNone(self.store.compress(11, 'a', '/missing'))
        self.assertIsNone(self.store.compress(12, 'ghost', '/a/x'))
        self.store.add(13, '/admin', 10)
        self.assertIsNone(self.store.compress(14, 'admin', '/admin'))

    def test_compress_rounds_up(self):
        self.assertEqual(self.store.compress(10, 'b', '/b/y'), 95)
        self.assertEqual(self.store.size_of(11, '/b/y.z'), 5)

    def test_compress_blocked_by_existing_target(self):
        self.store.add_as(10, 'a', '/a/x.z', 1)
        self.assertIsNone(self.store.compress(11, 'a', '/a/x'))
        self.assertEqual(self.store.size_of(12, '/a/x'), 40)

    def test_unknown_user_or_no_backup(self):
        self.assertIsNone(self.store.backup_user(10, 'ghost'))
        self.assertIsNone(self.store.restore_user(11, 'a'))
        self.assertIsNone(self.store.restore_user(12, 'ghost'))

    def test_restore_skips_paths_taken_by_others(self):
        self.store.backup_user(10, 'a')
        self.store.remove(11, '/a/x')
        self.store.add_as(12, 'b', '/a/x', 1)
        self.assertEqual(self.store.restore_user(13, 'a'), 0)
        self.assertEqual(self.store.size_of(14, '/a/x'), 1)
        self.assertEqual(self.store.remaining(15, 'a'), 100)

    def test_backup_replaces_previous_and_counts(self):
        self.store.backup_user(10, 'a')
        self.store.add_as(11, 'a', '/a/z', 5)
        self.assertEqual(self.store.backup_user(12, 'a'), 2)
        self.store.remove(13, '/a/z')
        self.store.remove(14, '/a/x')
        self.assertEqual(self.store.restore_user(15, 'a'), 2)
        self.assertEqual(self.store.total_size(16, '/a/'), 45)

    def test_restore_undoes_compression(self):
        self.store.backup_user(10, 'a')
        self.store.compress(11, 'a', '/a/x')
        self.assertEqual(self.store.restore_user(12, 'a'), 1)
        self.assertEqual(self.store.largest(13, '/a/', 5), ['/a/x(40)'])
        self.assertEqual(self.store.remaining(14, 'a'), 60)

    def test_empty_backup_clears_files(self):
        self.store.backup_user(10, 'b')
        self.store.remove(11, '/b/y')
        self.store.backup_user(12, 'b')
        self.store.add_as(13, 'b', '/b/q', 3)
        self.assertEqual(self.store.restore_user(14, 'b'), 0)
        self.assertIsNone(self.store.size_of(15, '/b/q'))
        self.assertEqual(self.store.size_of(16, '/a/x'), 40)
