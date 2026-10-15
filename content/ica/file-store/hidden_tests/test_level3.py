import unittest

from src.files import FileStore


class Level3Hidden(unittest.TestCase):
    def test_admin_is_not_a_user(self):
        store = FileStore()
        self.assertFalse(store.add_user(1, 'admin', 10))
        self.assertIsNone(store.add_as(2, 'admin', '/a', 1))
        self.assertIsNone(store.remaining(3, 'admin'))

    def test_admin_files_cost_no_quota(self):
        store = FileStore()
        store.add_user(1, 'bo', 100)
        store.add(2, '/big', 10**9)
        self.assertEqual(store.remaining(3, 'bo'), 100)
        self.assertIsNone(store.add_as(4, 'bo', '/big', 1))

    def test_path_taken_by_anyone(self):
        store = FileStore()
        store.add_user(1, 'a', 10)
        store.add_user(2, 'b', 10)
        store.add_as(3, 'a', '/shared', 3)
        self.assertIsNone(store.add_as(4, 'b', '/shared', 3))
        self.assertFalse(store.add(5, '/shared', 3))
        self.assertEqual(store.remaining(6, 'b'), 10)

    def test_failed_add_changes_nothing(self):
        store = FileStore()
        store.add_user(1, 'a', 10)
        self.assertIsNone(store.add_as(2, 'a', '/x', 11))
        self.assertIsNone(store.size_of(3, '/x'))
        self.assertEqual(store.remaining(4, 'a'), 10)

    def test_user_files_rank_with_the_rest(self):
        store = FileStore()
        store.add_user(1, 'a', 1000)
        store.add_as(2, 'a', '/u/a', 300)
        store.add(3, '/u/b', 200)
        self.assertEqual(store.largest(4, '/u/', 2), ['/u/a(300)', '/u/b(200)'])
        self.assertEqual(store.total_size(5, '/u/'), 500)

    def test_exact_fit_and_zero_quota(self):
        store = FileStore()
        store.add_user(1, 'z', 0)
        self.assertEqual(store.add_as(2, 'z', '/z0', 0), 0)
        self.assertIsNone(store.add_as(3, 'z', '/z1', 1))

    def test_quota_comes_back_per_owner(self):
        store = FileStore()
        store.add_user(1, 'a', 50)
        store.add_user(2, 'b', 50)
        store.add_as(3, 'a', '/a1', 20)
        store.add_as(4, 'b', '/b1', 30)
        store.remove(5, '/b1')
        self.assertEqual([store.remaining(6, 'a'), store.remaining(7, 'b')], [30, 50])
