import unittest

from src.ledger import Ledger


class Level3Test(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.ledger.open_account(1, 'ann')
        self.ledger.open_account(2, 'ben')
        self.ledger.deposit(3, 'ann', 1000)

    def test_runs_when_due(self):
        self.assertEqual(self.ledger.schedule_transfer(10, 'ann', 'ben', 300, 5), 'transfer1')
        self.assertEqual(self.ledger.deposit(14, 'ben', 1), 1)
        # Due at 15: it runs before the deposit at 15.
        self.assertEqual(self.ledger.deposit(15, 'ben', 1), 302)
        self.assertEqual(self.ledger.top_outgoing(16, 1), ['ann(300)'])

    def test_cancel_before_due(self):
        transfer_id = self.ledger.schedule_transfer(10, 'ann', 'ben', 300, 5)
        self.assertFalse(self.ledger.cancel_scheduled(11, 'ben', transfer_id))
        self.assertTrue(self.ledger.cancel_scheduled(12, 'ann', transfer_id))
        self.assertFalse(self.ledger.cancel_scheduled(13, 'ann', transfer_id))
        self.assertEqual(self.ledger.deposit(20, 'ben', 1), 1)

    def test_not_enough_money_when_due(self):
        self.ledger.schedule_transfer(10, 'ann', 'ben', 900, 5)
        self.ledger.withdraw(12, 'ann', 200)
        self.assertEqual(self.ledger.deposit(20, 'ann', 1), 801)
