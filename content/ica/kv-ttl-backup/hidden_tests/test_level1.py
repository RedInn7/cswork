import unittest

from src.store import Store


class Level1Hidden(unittest.TestCase):
    def test_delete_missing(self):
        self.assertFalse(Store().delete(1, 'nothing'))

    def test_put_after_delete_has_no_previous(self):
        store = Store()
        store.put(1, 'k', 'v1')
        store.delete(2, 'k')
        self.assertIsNone(store.put(3, 'k', 'v2'))
        self.assertEqual(store.get(4, 'k'), 'v2')

    def test_keys_are_independent(self):
        store = Store()
        store.put(1, 'a', '1')
        store.put(2, 'ab', '2')
        store.put(3, 'A', '3')
        store.delete(4, 'a')
        self.assertEqual([store.get(5, k) for k in ('a', 'ab', 'A')], [None, '2', '3'])

    def test_empty_strings_are_values(self):
        store = Store()
        self.assertIsNone(store.put(1, 'blank', ''))
        self.assertEqual(store.get(2, 'blank'), '')
        self.assertEqual(store.put(3, 'blank', 'x'), '')

    def test_many_keys(self):
        store = Store()
        for i in range(200):
            store.put(i + 1, f'k{i}', str(i * i))
        self.assertEqual(store.get(500, 'k150'), '22500')
        self.assertTrue(store.delete(501, 'k0'))
        self.assertIsNone(store.get(502, 'k0'))
