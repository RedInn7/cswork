import unittest

from src.files import FileStore


class Level1Hidden(unittest.TestCase):
    def test_zero_size_files(self):
        store = FileStore()
        self.assertTrue(store.add(1, '/empty', 0))
        self.assertEqual(store.size_of(2, '/empty'), 0)
        self.assertEqual(store.remove(3, '/empty'), 0)
        self.assertIsNone(store.size_of(4, '/empty'))

    def test_duplicate_add_keeps_the_first(self):
        store = FileStore()
        store.add(1, '/a', 10)
        store.add(2, '/a', 99)
        self.assertEqual(store.size_of(3, '/a'), 10)

    def test_paths_are_exact(self):
        store = FileStore()
        store.add(1, '/a', 1)
        store.add(2, '/a/', 2)
        store.add(3, '/A', 3)
        self.assertEqual([store.size_of(4, p) for p in ('/a', '/a/', '/A', 'a')], [1, 2, 3, None])

    def test_remove_missing(self):
        self.assertIsNone(FileStore().remove(1, '/nothing'))

    def test_many_files(self):
        store = FileStore()
        for i in range(300):
            store.add(i + 1, f'/f/{i}', i)
        self.assertEqual(store.remove(400, '/f/299'), 299)
        self.assertEqual(store.size_of(401, '/f/150'), 150)
