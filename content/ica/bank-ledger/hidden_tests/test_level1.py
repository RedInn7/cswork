import unittest

from src.ledger import Ledger


class Level1Hidden(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        for t, name in enumerate(['acc1', 'acc2', 'acc3'], start=1):
            self.ledger.open_account(t, name)

    def test_duplicate_open_keeps_balance(self):
        self.ledger.deposit(10, 'acc1', 70)
        self.assertFalse(self.ledger.open_account(11, 'acc1'))
        self.assertEqual(self.ledger.deposit(12, 'acc1', 5), 75)

    def test_withdraw_everything(self):
        self.ledger.deposit(10, 'acc2', 99)
        self.assertEqual(self.ledger.withdraw(11, 'acc2', 99), 0)
        self.assertIsNone(self.ledger.withdraw(12, 'acc2', 1))

    def test_failed_withdraw_changes_nothing(self):
        self.ledger.deposit(10, 'acc1', 50)
        self.assertIsNone(self.ledger.withdraw(11, 'acc1', 51))
        self.assertEqual(self.ledger.deposit(12, 'acc1', 1), 51)

    def test_transfer_to_self_or_unknown(self):
        self.ledger.deposit(10, 'acc1', 100)
        self.assertIsNone(self.ledger.transfer(11, 'acc1', 'acc1', 10))
        self.assertIsNone(self.ledger.transfer(12, 'acc1', 'ghost', 10))
        self.assertIsNone(self.ledger.transfer(13, 'ghost', 'acc1', 10))
        self.assertEqual(self.ledger.deposit(14, 'acc1', 1), 101)

    def test_transfer_moves_money_both_ways(self):
        self.ledger.deposit(10, 'acc1', 1000)
        self.assertEqual(self.ledger.transfer(11, 'acc1', 'acc2', 400), 600)
        self.assertEqual(self.ledger.transfer(12, 'acc2', 'acc3', 150), 250)
        self.assertEqual(self.ledger.withdraw(13, 'acc3', 150), 0)
        self.assertEqual(self.ledger.transfer(14, 'acc1', 'acc2', 600), 0)
        self.assertEqual(self.ledger.withdraw(15, 'acc2', 850), 0)

    def test_failed_transfer_changes_nothing(self):
        self.ledger.deposit(10, 'acc1', 30)
        self.assertIsNone(self.ledger.transfer(11, 'acc1', 'acc2', 31))
        self.assertIsNone(self.ledger.withdraw(12, 'acc2', 1))
        self.assertEqual(self.ledger.withdraw(13, 'acc1', 30), 0)

    def test_large_amounts(self):
        self.ledger.deposit(10, 'acc3', 10**12)
        self.assertEqual(self.ledger.deposit(11, 'acc3', 10**12), 2 * 10**12)
        self.assertEqual(self.ledger.transfer(12, 'acc3', 'acc1', 10**12 + 7), 10**12 - 7)
