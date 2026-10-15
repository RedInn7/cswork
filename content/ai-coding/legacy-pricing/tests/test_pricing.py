import unittest

from src.pricing import quote


class QuoteTest(unittest.TestCase):
    def test_light_domestic(self):
        self.assertEqual(quote(800, 'domestic'), 500)

    def test_international_member(self):
        self.assertEqual(quote(1200, 'international', member=True), 2565)

    def test_remote_zone(self):
        self.assertEqual(quote(800, 'remote'), 700)


if __name__ == '__main__':
    unittest.main()
