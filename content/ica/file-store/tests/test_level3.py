import unittest

from src.files import FileStore


class Level3Test(unittest.TestCase):
    def test_quota(self):
        store = FileStore()
        self.assertTrue(store.add_user(1, 'ann', 1000))
        self.assertFalse(store.add_user(2, 'ann', 5))
        self.assertEqual(store.add_as(3, 'ann', '/ann/a', 600), 400)
        self.assertIsNone(store.add_as(4, 'ann', '/ann/b', 401))
        self.assertEqual(store.add_as(5, 'ann', '/ann/b', 400), 0)
        self.assertEqual(store.remove(6, '/ann/a'), 600)
        self.assertEqual(store.remaining(7, 'ann'), 600)

    def test_unknown_user(self):
        store = FileStore()
        self.assertIsNone(store.add_as(1, 'ghost', '/g', 1))
        self.assertIsNone(store.remaining(2, 'ghost'))
