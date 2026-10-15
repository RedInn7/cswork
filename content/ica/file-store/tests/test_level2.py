import unittest

from src.files import FileStore


class Level2Test(unittest.TestCase):
    def test_largest_by_prefix(self):
        store = FileStore()
        store.add(1, '/img/cat.png', 300)
        store.add(2, '/img/dog.png', 500)
        store.add(3, '/img/ant.png', 300)
        store.add(4, '/docs/plan.md', 900)
        self.assertEqual(store.largest(5, '/img/', 2), ['/img/dog.png(500)', '/img/ant.png(300)'])
        self.assertEqual(store.total_size(6, '/img/'), 1100)
        self.assertEqual(store.largest(7, '/none/', 3), [])
