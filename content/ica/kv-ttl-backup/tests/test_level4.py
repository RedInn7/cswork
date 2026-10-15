import unittest

from src.store import Store


class Level4Test(unittest.TestCase):
    def test_restore_replaces_everything(self):
        store = Store()
        store.put(1, 'a', '1')
        store.put(2, 'b', '2')
        self.assertEqual(store.backup(3), 2)
        store.put(4, 'a', 'changed')
        store.put(5, 'c', 'new')
        self.assertTrue(store.restore(6, 3))
        self.assertEqual(store.scan(7, ''), ['a=1', 'b=2'])

    def test_no_backup_yet(self):
        store = Store()
        store.put(1, 'a', '1')
        store.backup(5)
        self.assertFalse(store.restore(6, 4))
        self.assertEqual(store.get(7, 'a'), '1')

    def test_ttl_is_resumed(self):
        store = Store()
        store.put_ttl(10, 'k', 'v', 10)
        store.backup(14)
        self.assertTrue(store.restore(100, 14))
        self.assertEqual(store.ttl_left(101, 'k'), 5)
        self.assertIsNone(store.get(106, 'k'))
