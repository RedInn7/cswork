import unittest

from src.ledger import Ledger


class Level1Test(unittest.TestCase):
    def test_open_and_deposit(self):
        ledger = Ledger()
        self.assertTrue(ledger.open_account(1, 'alice'))
        self.assertFalse(ledger.open_account(2, 'alice'))
        self.assertEqual(ledger.deposit(3, 'alice', 500), 500)
        self.assertEqual(ledger.deposit(4, 'alice', 250), 750)
        self.assertIsNone(ledger.deposit(5, 'bob', 100))

    def test_withdraw(self):
        ledger = Ledger()
        ledger.open_account(1, 'alice')
        ledger.deposit(2, 'alice', 300)
        self.assertEqual(ledger.withdraw(3, 'alice', 120), 180)
        self.assertIsNone(ledger.withdraw(4, 'alice', 181))
        self.assertIsNone(ledger.withdraw(5, 'nobody', 1))

    def test_transfer(self):
        ledger = Ledger()
        ledger.open_account(1, 'alice')
        ledger.open_account(2, 'bob')
        ledger.deposit(3, 'alice', 400)
        self.assertEqual(ledger.transfer(4, 'alice', 'bob', 150), 250)
        self.assertEqual(ledger.deposit(5, 'bob', 1), 151)
        self.assertIsNone(ledger.transfer(6, 'alice', 'bob', 251))
