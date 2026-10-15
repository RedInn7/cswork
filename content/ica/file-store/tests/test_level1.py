import unittest

from src.files import FileStore


class Level1Test(unittest.TestCase):
    def test_add_and_size(self):
        store = FileStore()
        self.assertTrue(store.add(1, '/docs/a.txt', 120))
        self.assertFalse(store.add(2, '/docs/a.txt', 5))
        self.assertEqual(store.size_of(3, '/docs/a.txt'), 120)
        self.assertIsNone(store.size_of(4, '/docs/b.txt'))

    def test_remove(self):
        store = FileStore()
        store.add(1, '/x', 7)
        self.assertEqual(store.remove(2, '/x'), 7)
        self.assertIsNone(store.remove(3, '/x'))
        self.assertTrue(store.add(4, '/x', 9))
