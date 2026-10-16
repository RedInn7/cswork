import unittest

from src.errors import AliasTaken, InvalidUrl, NotFound, RateLimited
from src.shortener import Shortener


class FakeClock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


class ShortenerTest(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.shortener = Shortener(limit=3, window=60, clock=self.clock)

    def test_a_code_resolves_to_its_url(self):
        code = self.shortener.shorten('https://example.com/a?b=1', 'client-1')
        self.assertRegex(code, r'^[0-9A-Za-z]{7}$')
        self.assertEqual(self.shortener.resolve(code), 'https://example.com/a?b=1')
        self.assertEqual(self.shortener.stats(code), {'url': 'https://example.com/a?b=1', 'hits': 1, 'client': 'client-1'})

    def test_the_same_url_twice_gives_the_same_code(self):
        first = self.shortener.shorten('https://example.com', 'client-1')
        self.assertEqual(self.shortener.shorten('https://example.com', 'client-1'), first)

    def test_bad_urls_are_refused(self):
        # A refused URL still counts against the limit: one client each.
        for i, url in enumerate(['example.com', 'ftp://example.com/file', 'https://', 'https://exa mple.com']):
            with self.assertRaises(InvalidUrl, msg=url):
                self.shortener.shorten(url, 'client-%d' % i)

    def test_aliases(self):
        self.assertEqual(self.shortener.shorten('https://example.com', 'client-1', alias='launch'), 'launch')
        with self.assertRaises(AliasTaken):
            self.shortener.shorten('https://example.org', 'client-2', alias='launch')
        with self.assertRaises(NotFound):
            self.shortener.resolve('Launch')

    def test_rate_limit_per_client(self):
        for i in range(3):
            self.shortener.shorten('https://example.com/%d' % i, 'client-1')
        with self.assertRaises(RateLimited) as caught:
            self.shortener.shorten('https://example.com/3', 'client-1')
        self.assertAlmostEqual(caught.exception.retry_after, 60)
        self.shortener.shorten('https://example.com/3', 'client-2')
        self.clock.now += 60
        self.shortener.shorten('https://example.com/3', 'client-1')


if __name__ == '__main__':
    unittest.main()
