import unittest

from src.pricing import quote


def legacy(weight_g, zone, member=False, coupon=None):
    base = {'domestic': 500, 'international': 1800}
    per_kg = {'domestic': 150, 'international': 900}
    if zone == 'domestic':
        if weight_g <= 1000:
            price = 500
        elif weight_g <= 5000:
            price = 500 + (weight_g - 1000 + 999) // 1000 * 150
        else:
            price = 500 + 600 + (weight_g - 5000 + 999) // 1000 * 150 // 2
    else:
        price = base['international'] if weight_g <= 500 else 1800 + (weight_g - 500 + 499) // 500 * per_kg['international'] // 2
        if price > 10000:
            price = 10000 + (price - 10000) // 2
    if member:
        if zone == 'domestic':
            price = price - 300 if price >= 2000 else price * 9 // 10
        else:
            price = price * 95 // 100
    if coupon:
        code = coupon.strip().upper()
        if code == 'FREESHIP':
            off = price if zone == 'domestic' else 0
        elif code == 'TENOFF':
            off = min(price, 1000)
        elif code.startswith('PCT') and code[3:].isdigit():
            off = price * min(int(code[3:]), 50) // 100
        else:
            off = 0
        price -= off
    return max(price, 0)


WEIGHTS = [1, 499, 500, 501, 999, 1000, 1001, 1999, 2000, 4999, 5000, 5001, 5999, 6000, 9999, 20000, 47001, 80000]
COUPONS = [None, '', 'FREESHIP', ' freeship ', 'TENOFF', 'PCT10', 'PCT75', 'PCTX', 'BOGUS']


class CharacterizationTest(unittest.TestCase):
    def test_every_existing_price_is_unchanged(self):
        for zone in ('domestic', 'international'):
            for weight in WEIGHTS:
                for member in (False, True):
                    for coupon in COUPONS:
                        with self.subTest(zone=zone, weight=weight, member=member, coupon=coupon):
                            self.assertEqual(quote(weight, zone, member=member, coupon=coupon), legacy(weight, zone, member, coupon))

    def test_bad_input(self):
        for weight in (0, -5, 1.5, '100', True):
            with self.assertRaises(ValueError):
                quote(weight, 'domestic')
        with self.assertRaises(ValueError):
            quote(100, 'moon')


class RemoteTest(unittest.TestCase):
    def test_forty_percent_over_domestic(self):
        for weight in WEIGHTS:
            with self.subTest(weight=weight):
                self.assertEqual(quote(weight, 'remote'), legacy(weight, 'domestic') * 14 // 10)

    def test_no_member_discount(self):
        for weight in (800, 3000, 12000):
            self.assertEqual(quote(weight, 'remote', member=True), quote(weight, 'remote'))

    def test_freeship_does_not_apply(self):
        self.assertEqual(quote(3000, 'remote', coupon='FREESHIP'), quote(3000, 'remote'))

    def test_other_coupons_apply(self):
        price = quote(3000, 'remote')
        self.assertEqual(quote(3000, 'remote', coupon='TENOFF'), price - 1000)
        self.assertEqual(quote(3000, 'remote', member=True, coupon='pct20'), price - price * 20 // 100)
        self.assertEqual(quote(100, 'remote', coupon='TENOFF'), 0)


if __name__ == '__main__':
    unittest.main()
