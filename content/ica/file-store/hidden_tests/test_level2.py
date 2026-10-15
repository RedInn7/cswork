import unittest

from src.files import FileStore


class Level2Hidden(unittest.TestCase):
    def setUp(self):
        self.store = FileStore()
        for t, (path, size) in enumerate([('/a/1', 5), ('/a/2', 50), ('/a/10', 50), ('/ab/1', 500), ('/b/1', 7)], start=1):
            self.store.add(t, path, size)

    def test_empty_prefix_is_every_file(self):
        self.assertEqual(self.store.largest(10, '', 10), ['/ab/1(500)', '/a/10(50)', '/a/2(50)', '/b/1(7)', '/a/1(5)'])
        self.assertEqual(self.store.total_size(11, ''), 612)

    def test_prefix_is_plain_string_prefix(self):
        self.assertEqual(self.store.largest(10, '/a', 2), ['/ab/1(500)', '/a/10(50)'])
        self.assertEqual(self.store.total_size(11, '/a/'), 105)

    def test_n_beyond_matches(self):
        self.assertEqual(self.store.largest(10, '/b', 5), ['/b/1(7)'])

    def test_removed_files_leave(self):
        self.store.remove(10, '/ab/1')
        self.assertEqual(self.store.largest(11, '', 1), ['/a/10(50)'])
        self.assertEqual(self.store.total_size(12, '/ab'), 0)

    def test_zero_sizes_listed(self):
        self.store.add(10, '/z', 0)
        self.assertEqual(self.store.largest(11, '/z', 1), ['/z(0)'])
