import re
import unittest

from src.errors import AliasTaken, InvalidAlias, InvalidUrl, NotFound, RateLimited, ShortenerError
from src.shortener import Shortener


class FakeClock:
    def __init__(self, now=5000.0):
        self.now = now

    def __call__(self):
        return self.now


def make(limit=1000, window=60):
    clock = FakeClock()
    return Shortener(limit=limit, window=window, clock=clock), clock


class CodeTest(unittest.TestCase):
    def test_codes_are_seven_characters_and_unique(self):
        shortener, _ = make(limit=10_000)
        codes = {shortener.shorten('https://example.com/%d' % i, 'c') for i in range(2000)}
        self.assertEqual(len(codes), 2000)
        self.assertTrue(all(re.fullmatch(r'[0-9A-Za-z]{7}', code) for code in codes))

    def test_each_client_gets_its_own_link(self):
        shortener, _ = make()
        a = shortener.shorten('https://example.com', 'a')
        b = shortener.shorten('https://example.com', 'b')
        self.assertNotEqual(a, b)
        self.assertEqual(shortener.stats(b)['client'], 'b')

    def test_url_is_stored_trimmed_and_deduplicated_trimmed(self):
        shortener, _ = make()
        code = shortener.shorten('  https://example.com/x  ', 'a')
        self.assertEqual(shortener.resolve(code), 'https://example.com/x')
        self.assertEqual(shortener.shorten('https://example.com/x', 'a'), code)

    def test_alias_and_ttl_links_are_never_deduplicated(self):
        shortener, _ = make()
        plain = shortener.shorten('https://example.com', 'a')
        self.assertEqual(shortener.shorten('https://example.com', 'a', alias='mine'), 'mine')
        timed = shortener.shorten('https://example.com', 'a', ttl=30)
        self.assertNotIn(timed, (plain, 'mine'))
        self.assertNotEqual(shortener.shorten('https://example.com', 'a', ttl=30), timed)
        self.assertEqual(shortener.shorten('https://example.com', 'a'), plain)


class ValidationTest(unittest.TestCase):
    def test_urls(self):
        shortener, _ = make()
        good = ['http://example.com', 'HTTPS://Example.com/a/b?c=d#e', 'https://localhost:8080/', 'https://例子.测试/路径',
                'https://example.com/' + 'a' * (2048 - 20)]
        bad = ['', '   ', 'example.com', '//example.com', 'mailto:a@example.com', 'javascript:alert(1)', 'ftp://example.com',
               'https://', 'http:///path', 'https://exa mple.com', 'https://example.com/a\tb', 'https://example.com/\nx',
               'https://example.com/' + 'a' * (2048 - 19), None, 42, b'https://example.com']
        for url in good:
            self.assertEqual(shortener.resolve(shortener.shorten(url, 'c')), url.strip(), url)
        for url in bad:
            with self.assertRaises(InvalidUrl, msg=repr(url)):
                shortener.shorten(url, 'c')

    def test_aliases(self):
        shortener, _ = make()
        for alias in ['abc', 'a' * 30, 'Launch-2026_v2', '---']:
            self.assertEqual(shortener.shorten('https://example.com', 'c', alias=alias), alias)
        for alias in ['ab', 'a' * 31, 'has space', 'émoji', 'a/b', 'a.b', '', 7]:
            with self.assertRaises(InvalidAlias, msg=repr(alias)):
                shortener.shorten('https://example.com', 'c', alias=alias)
        self.assertEqual(shortener.shorten('https://example.com', 'c', alias='ABC'), 'ABC')

    def test_an_alias_cannot_take_a_generated_code(self):
        shortener, _ = make()
        code = shortener.shorten('https://example.com', 'c')
        with self.assertRaises(AliasTaken):
            shortener.shorten('https://example.org', 'd', alias=code)

    def test_ttl_must_be_a_positive_number(self):
        shortener, _ = make()
        for ttl in [0, -1, float('nan'), float('inf'), '60', True]:
            with self.assertRaises(ValueError, msg=repr(ttl)):
                shortener.shorten('https://example.com', 'c', ttl=ttl)
        self.assertTrue(shortener.shorten('https://example.com', 'c', ttl=0.5))

    def test_errors_share_one_base(self):
        for error in (InvalidUrl, InvalidAlias, AliasTaken, NotFound, RateLimited):
            self.assertTrue(issubclass(error, ShortenerError))


class ExpiryTest(unittest.TestCase):
    def test_a_link_expires_after_its_ttl(self):
        shortener, clock = make()
        code = shortener.shorten('https://example.com', 'c', ttl=10)
        clock.now += 9.999
        self.assertEqual(shortener.resolve(code), 'https://example.com')
        clock.now += 0.001
        with self.assertRaises(NotFound):
            shortener.resolve(code)
        with self.assertRaises(NotFound):
            shortener.stats(code)

    def test_an_expired_alias_stays_taken(self):
        shortener, clock = make()
        shortener.shorten('https://example.com', 'c', alias='sale', ttl=5)
        clock.now += 6
        with self.assertRaises(AliasTaken):
            shortener.shorten('https://example.org', 'c', alias='sale')

    def test_hits_count_resolves_only(self):
        shortener, _ = make()
        code = shortener.shorten('https://example.com', 'c')
        for _ in range(4):
            shortener.resolve(code)
        shortener.stats(code)
        self.assertEqual(shortener.stats(code), {'url': 'https://example.com', 'hits': 4, 'client': 'c'})
        with self.assertRaises(NotFound):
            shortener.resolve(code.swapcase() if code.swapcase() != code else code + 'x')
        with self.assertRaises(NotFound):
            shortener.stats('nothing')


class RateLimitTest(unittest.TestCase):
    def test_sliding_window(self):
        shortener, clock = make(limit=3, window=10)
        for offset in (0, 4, 8):
            clock.now = 5000 + offset
            shortener.shorten('https://example.com/%d' % offset, 'c')
        clock.now = 5009.5
        with self.assertRaises(RateLimited) as caught:
            shortener.shorten('https://example.com/x', 'c')
        self.assertAlmostEqual(caught.exception.retry_after, 0.5)
        clock.now = 5010
        shortener.shorten('https://example.com/x', 'c')
        with self.assertRaises(RateLimited) as caught:
            shortener.shorten('https://example.com/y', 'c')
        self.assertAlmostEqual(caught.exception.retry_after, 4)

    def test_refused_calls_do_not_count_and_failed_ones_do(self):
        shortener, clock = make(limit=2, window=60)
        with self.assertRaises(InvalidUrl):
            shortener.shorten('not a url', 'c')
        shortener.shorten('https://example.com', 'c')
        for _ in range(5):
            with self.assertRaises(RateLimited):
                shortener.shorten('https://example.com', 'c')
        clock.now += 60
        shortener.shorten('https://example.com/2', 'c')
        shortener.shorten('https://example.com/3', 'c')

    def test_clients_have_separate_limits_and_reads_are_free(self):
        shortener, _ = make(limit=1, window=60)
        code = shortener.shorten('https://example.com', 'a')
        shortener.shorten('https://example.com', 'b')
        for _ in range(50):
            shortener.resolve(code)
        with self.assertRaises(RateLimited):
            shortener.shorten('https://example.com', 'a')

    def test_default_clock_and_limits(self):
        shortener = Shortener()
        for i in range(10):
            shortener.shorten('https://example.com/%d' % i, 'c')
        with self.assertRaises(RateLimited):
            shortener.shorten('https://example.com/10', 'c')


if __name__ == '__main__':
    unittest.main()
