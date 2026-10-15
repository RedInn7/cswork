import unittest

from src.errors import InventoryError, OutOfStock, UnknownSku
from src.inventory import Inventory


class ContractTest(unittest.TestCase):
    def setUp(self):
        self.inv = Inventory()
        self.inv.restock('mug', 5)

    def test_last_unit_goes_to_one_order(self):
        self.inv.reserve('a', 'mug', 4)
        self.inv.reserve('b', 'mug', 1)
        with self.assertRaises(OutOfStock):
            self.inv.reserve('c', 'mug', 1)
        self.assertEqual(self.inv.available('mug'), 0)

    def test_release_frees_units(self):
        self.inv.reserve('a', 'mug', 5)
        self.assertTrue(self.inv.release('a'))
        self.assertEqual(self.inv.available('mug'), 5)
        self.inv.reserve('b', 'mug', 5)

    def test_double_release_changes_nothing(self):
        self.inv.reserve('a', 'mug', 2)
        self.assertTrue(self.inv.release('a'))
        self.assertFalse(self.inv.release('a'))
        self.assertEqual(self.inv.available('mug'), 5)

    def test_release_unknown_order(self):
        self.assertFalse(self.inv.release('nope'))
        self.assertEqual(self.inv.available('mug'), 5)

    def test_released_order_cannot_ship(self):
        self.inv.reserve('a', 'mug', 2)
        self.inv.release('a')
        with self.assertRaises(InventoryError):
            self.inv.ship('a')
        self.assertEqual(self.inv.available('mug'), 5)

    def test_ship_unknown_order(self):
        with self.assertRaises(InventoryError):
            self.inv.ship('ghost')

    def test_duplicate_order_id(self):
        self.inv.reserve('a', 'mug', 1)
        with self.assertRaises(InventoryError):
            self.inv.reserve('a', 'mug', 1)
        self.assertEqual(self.inv.available('mug'), 4)

    def test_non_positive_quantities(self):
        for bad in (0, -2):
            with self.assertRaises(ValueError):
                self.inv.restock('mug', bad)
            with self.assertRaises(ValueError):
                self.inv.reserve('x%d' % bad, 'mug', bad)
        self.assertEqual(self.inv.available('mug'), 5)

    def test_failed_reserve_holds_nothing(self):
        with self.assertRaises(OutOfStock):
            self.inv.reserve('a', 'mug', 6)
        self.assertFalse(self.inv.release('a'))
        self.assertEqual(self.inv.available('mug'), 5)

    def test_unknown_sku_available(self):
        with self.assertRaises(UnknownSku):
            self.inv.available('plate')

    def test_skus_are_independent(self):
        self.inv.restock('plate', 1)
        self.inv.reserve('a', 'plate', 1)
        self.assertEqual(self.inv.available('mug'), 5)
        self.assertEqual(self.inv.available('plate'), 0)


if __name__ == '__main__':
    unittest.main()
