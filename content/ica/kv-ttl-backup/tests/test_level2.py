import unittest

from src.store import Store


class Level2Test(unittest.TestCase):
    def test_scan_sorted_by_key(self):
        store = Store()
        store.put(1, 'user:2', 'bo')
        store.put(2, 'user:10', 'al')
        store.put(3, 'team:1', 'red')
        self.assertEqual(store.scan(4, 'user:'), ['user:10=al', 'user:2=bo'])
        self.assertEqual(store.count(5, 'user:'), 2)
        self.assertEqual(store.scan(6, 'nobody'), [])
