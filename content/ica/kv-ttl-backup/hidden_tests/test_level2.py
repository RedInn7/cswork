import unittest

from src.store import Store


class Level2Hidden(unittest.TestCase):
    def setUp(self):
        self.store = Store()
        for t, (k, v) in enumerate([('app', '1'), ('apple', '2'), ('apply', '3'), ('banana', '4'), ('Apple', '5')], start=1):
            self.store.put(t, k, v)

    def test_empty_prefix_scans_everything(self):
        self.assertEqual(self.store.scan(10, ''), ['Apple=5', 'app=1', 'apple=2', 'apply=3', 'banana=4'])
        self.assertEqual(self.store.count(11, ''), 5)

    def test_prefix_is_case_sensitive_and_includes_exact_key(self):
        self.assertEqual(self.store.scan(10, 'app'), ['app=1', 'apple=2', 'apply=3'])
        self.assertEqual(self.store.count(11, 'App'), 1)

    def test_deleted_keys_leave_scans(self):
        self.store.delete(10, 'apple')
        self.assertEqual(self.store.scan(11, 'appl'), ['apply=3'])
        self.assertEqual(self.store.count(12, 'apple'), 0)

    def test_updates_show_new_values(self):
        self.store.put(10, 'apply', 'x')
        self.assertEqual(self.store.scan(11, 'apply'), ['apply=x'])

    def test_values_may_contain_equals(self):
        self.store.put(10, 'eq', 'a=b')
        self.assertEqual(self.store.scan(11, 'eq'), ['eq=a=b'])
