import unittest

from src.ledger import Ledger


class Level4Test(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.ledger.open_account(1, 'ann')
        self.ledger.open_account(2, 'ben')
        self.ledger.deposit(3, 'ann', 100)
        self.ledger.deposit(4, 'ben', 40)

    def test_merge_moves_balance(self):
        self.assertTrue(self.ledger.merge(10, 'ann', 'ben'))
        self.assertEqual(self.ledger.deposit(11, 'ann', 1), 141)
        self.assertIsNone(self.ledger.deposit(12, 'ben', 1))
        self.assertFalse(self.ledger.merge(13, 'ann', 'ann'))

    def test_balance_at(self):
        self.ledger.withdraw(6, 'ann', 30)
        self.assertIsNone(self.ledger.balance_at(7, 'ann', 0))
        self.assertEqual(self.ledger.balance_at(8, 'ann', 1), 0)
        self.assertEqual(self.ledger.balance_at(9, 'ann', 5), 100)
        self.assertEqual(self.ledger.balance_at(10, 'ann', 6), 70)

    def test_merged_account_keeps_its_own_past(self):
        self.ledger.merge(10, 'ann', 'ben')
        self.assertEqual(self.ledger.balance_at(11, 'ben', 9), 40)
        self.assertIsNone(self.ledger.balance_at(12, 'ben', 10))
        self.assertEqual(self.ledger.balance_at(13, 'ann', 9), 100)
        self.assertEqual(self.ledger.balance_at(14, 'ann', 10), 140)
