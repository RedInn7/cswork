import unittest

from src.files import FileStore


class Level4Test(unittest.TestCase):
    def setUp(self):
        self.store = FileStore()
        self.store.add_user(1, 'ann', 1000)
        self.store.add_as(2, 'ann', '/ann/log', 301)

    def test_compress(self):
        self.assertEqual(self.store.compress(3, 'ann', '/ann/log'), 849)
        self.assertIsNone(self.store.size_of(4, '/ann/log'))
        self.assertEqual(self.store.size_of(5, '/ann/log.z'), 151)
        self.assertIsNone(self.store.compress(6, 'ann', '/ann/log.z'))

    def test_backup_and_restore(self):
        self.assertEqual(self.store.backup_user(3, 'ann'), 1)
        self.store.add_as(4, 'ann', '/ann/new', 10)
        self.store.remove(5, '/ann/log')
        self.assertEqual(self.store.restore_user(6, 'ann'), 1)
        self.assertEqual(self.store.size_of(7, '/ann/log'), 301)
        self.assertIsNone(self.store.size_of(8, '/ann/new'))
        self.assertEqual(self.store.remaining(9, 'ann'), 699)
