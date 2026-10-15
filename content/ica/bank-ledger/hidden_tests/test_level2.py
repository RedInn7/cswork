import unittest

from src.ledger import Ledger


class Level2Hidden(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        for t, name in enumerate(['a1', 'a2', 'a3', 'a4'], start=1):
            self.ledger.open_account(t, name)
        for t, name in enumerate(['a1', 'a2', 'a3', 'a4'], start=101):
            self.ledger.deposit(t, name, 500)

    def test_failed_operations_do_not_count(self):
        self.ledger.withdraw(200, 'a1', 501)
        self.ledger.transfer(201, 'a2', 'a3', 600)
        self.ledger.transfer(202, 'a2', 'a2', 10)
        self.assertEqual(self.ledger.top_outgoing(203, 2), ['a1(0)', 'a2(0)'])

    def test_deposits_and_incoming_do_not_count(self):
        self.ledger.transfer(200, 'a1', 'a4', 100)
        self.ledger.deposit(201, 'a4', 999)
        self.assertEqual(self.ledger.top_outgoing(202, 2), ['a1(100)', 'a2(0)'])

    def test_totals_accumulate(self):
        self.ledger.withdraw(200, 'a3', 10)
        self.ledger.withdraw(201, 'a3', 20)
        self.ledger.transfer(202, 'a3', 'a1', 30)
        self.ledger.transfer(203, 'a4', 'a1', 60)
        self.assertEqual(self.ledger.top_outgoing(204, 4), ['a3(60)', 'a4(60)', 'a1(0)', 'a2(0)'])

    def test_n_beyond_account_count(self):
        self.assertEqual(len(self.ledger.top_outgoing(200, 10)), 4)

    def test_empty_ledger(self):
        self.assertEqual(Ledger().top_outgoing(1, 3), [])

    def test_new_account_appears(self):
        self.ledger.withdraw(200, 'a2', 1)
        self.ledger.open_account(201, 'a0')
        self.assertEqual(self.ledger.top_outgoing(202, 3), ['a2(1)', 'a0(0)', 'a1(0)'])
