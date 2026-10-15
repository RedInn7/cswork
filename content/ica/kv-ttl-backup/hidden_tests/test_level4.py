import unittest

from src.store import Store


class Level4Hidden(unittest.TestCase):
    def test_backup_counts_only_live_keys(self):
        store = Store()
        store.put_ttl(1, 'gone', 'x', 2)
        store.put(2, 'stay', 'y')
        self.assertEqual(store.backup(3), 1)
        self.assertEqual(Store().backup(1), 0)

    def test_latest_backup_at_or_before_the_time(self):
        store = Store()
        store.put(1, 'v', 'first')
        store.backup(2)
        store.put(3, 'v', 'second')
        store.backup(4)
        store.put(5, 'v', 'third')
        self.assertTrue(store.restore(6, 3))
        self.assertEqual(store.get(7, 'v'), 'first')
        self.assertTrue(store.restore(8, 4))
        self.assertEqual(store.get(9, 'v'), 'second')
        self.assertTrue(store.restore(10, 1000))
        self.assertEqual(store.get(11, 'v'), 'second')

    def test_restore_removes_later_keys(self):
        store = Store()
        store.backup(1)
        store.put(2, 'late', 'x')
        self.assertTrue(store.restore(3, 1))
        self.assertEqual(store.count(4, ''), 0)

    def test_restored_store_keeps_working(self):
        store = Store()
        store.put(1, 'a', '1')
        store.backup(2)
        store.restore(3, 2)
        self.assertEqual(store.put(4, 'a', '2'), '1')
        store.restore(5, 2)
        self.assertEqual(store.get(6, 'a'), '1')

    def test_plain_keys_stay_plain(self):
        store = Store()
        store.put(1, 'p', 'x')
        store.backup(2)
        store.restore(50, 2)
        self.assertEqual(store.ttl_left(51, 'p'), -1)

    def test_remaining_ttl_from_backup_time(self):
        store = Store()
        store.put_ttl(10, 'a', '1', 30)
        store.put_ttl(12, 'b', '2', 5)
        store.backup(15)
        self.assertTrue(store.restore(40, 15))
        self.assertEqual(store.scan(41, ''), ['a=1', 'b=2'])
        self.assertEqual(store.ttl_left(42, 'a'), 23)
        self.assertEqual(store.scan(43, ''), ['a=1'])
        self.assertIsNone(store.get(65, 'a'))

    def test_failed_restore_changes_nothing(self):
        store = Store()
        store.put_ttl(5, 'k', 'v', 100)
        self.assertFalse(store.restore(6, 5))
        self.assertEqual(store.ttl_left(7, 'k'), 98)
