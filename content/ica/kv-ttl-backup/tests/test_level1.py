import unittest

from src.store import Store


class Level1Test(unittest.TestCase):
    def test_put_returns_the_previous_value(self):
        store = Store()
        self.assertIsNone(store.put(1, 'city', 'Oslo'))
        self.assertEqual(store.put(2, 'city', 'Lima'), 'Oslo')
        self.assertEqual(store.get(3, 'city'), 'Lima')
        self.assertIsNone(store.get(4, 'country'))

    def test_delete(self):
        store = Store()
        store.put(1, 'a', 'x')
        self.assertTrue(store.delete(2, 'a'))
        self.assertFalse(store.delete(3, 'a'))
        self.assertIsNone(store.get(4, 'a'))
