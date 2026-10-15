import unittest

from src.errors import OutOfStock, UnknownSku
from src.inventory import Inventory


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.inv = Inventory()
        self.inv.restock('mug', 3)

    def test_restock_returns_available(self):
        self.assertEqual(self.inv.restock('mug', 2), 5)

    def test_reserve_and_ship(self):
        self.inv.reserve('o1', 'mug', 2)
        self.assertEqual(self.inv.available('mug'), 1)
        self.inv.ship('o1')
        self.assertEqual(self.inv.available('mug'), 1)

    def test_unknown_sku(self):
        with self.assertRaises(UnknownSku):
            self.inv.reserve('o1', 'plate', 1)

    def test_cannot_reserve_units_already_held(self):
        self.inv.reserve('o1', 'mug', 2)
        with self.assertRaises(OutOfStock):
            self.inv.reserve('o2', 'mug', 2)


if __name__ == '__main__':
    unittest.main()
