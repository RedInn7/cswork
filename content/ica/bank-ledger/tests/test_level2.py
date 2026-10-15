import unittest

from src.ledger import Ledger


class Level2Test(unittest.TestCase):
    def test_ranks_by_money_sent(self):
        ledger = Ledger()
        for t, name in enumerate(['ann', 'ben', 'cy'], start=1):
            ledger.open_account(t, name)
        for t, name in enumerate(['ann', 'ben', 'cy'], start=11):
            ledger.deposit(t, name, 1000)
        ledger.withdraw(20, 'ben', 300)
        ledger.transfer(21, 'cy', 'ann', 200)
        ledger.transfer(22, 'cy', 'ben', 50)
        self.assertEqual(ledger.top_outgoing(23, 3), ['ben(300)', 'cy(250)', 'ann(0)'])
        self.assertEqual(ledger.top_outgoing(24, 1), ['ben(300)'])

    def test_ties_by_account_id(self):
        ledger = Ledger()
        for t, name in enumerate(['zed', 'amy', 'kim'], start=1):
            ledger.open_account(t, name)
        self.assertEqual(ledger.top_outgoing(10, 5), ['amy(0)', 'kim(0)', 'zed(0)'])
