import unittest

from src.ledger import Ledger


class Level4Hidden(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        for t, name in enumerate(['a', 'b', 'c'], start=1):
            self.ledger.open_account(t, name)
        for t, name in enumerate(['a', 'b', 'c'], start=1):
            self.ledger.deposit(t + 10, name, 100 * t)

    def test_merge_rejects_unknown(self):
        self.assertFalse(self.ledger.merge(20, 'a', 'ghost'))
        self.assertFalse(self.ledger.merge(21, 'ghost', 'a'))
        self.assertTrue(self.ledger.merge(22, 'a', 'b'))
        self.assertFalse(self.ledger.merge(23, 'a', 'b'))

    def test_merged_id_cannot_return(self):
        self.ledger.merge(20, 'a', 'b')
        self.assertFalse(self.ledger.open_account(21, 'b'))
        self.assertIsNone(self.ledger.withdraw(22, 'b', 1))
        self.assertIsNone(self.ledger.transfer(23, 'a', 'b', 1))
        self.assertEqual(self.ledger.top_outgoing(24, 5), ['a(0)', 'c(0)'])

    def test_outgoing_totals_combine(self):
        self.ledger.withdraw(20, 'a', 10)
        self.ledger.withdraw(21, 'b', 25)
        self.ledger.withdraw(22, 'c', 30)
        self.ledger.merge(23, 'a', 'b')
        self.assertEqual(self.ledger.top_outgoing(24, 2), ['a(35)', 'c(30)'])

    def test_pending_transfers_follow_the_kept_account(self):
        out_id = self.ledger.schedule_transfer(20, 'b', 'c', 50, 30)
        in_id = self.ledger.schedule_transfer(21, 'c', 'b', 20, 30)
        self.ledger.merge(22, 'a', 'b')
        self.assertFalse(self.ledger.cancel_scheduled(23, 'b', out_id))
        self.assertTrue(self.ledger.cancel_scheduled(24, 'a', out_id))
        self.assertEqual(self.ledger.deposit(60, 'a', 1), 100 + 200 + 21)
        self.assertIsNotNone(in_id)

    def test_pending_transfer_between_merged_accounts_is_cancelled(self):
        transfer_id = self.ledger.schedule_transfer(20, 'a', 'b', 50, 30)
        self.ledger.merge(22, 'a', 'b')
        self.assertFalse(self.ledger.cancel_scheduled(23, 'a', transfer_id))
        self.assertEqual(self.ledger.top_outgoing(60, 1), ['a(0)'])
        self.assertEqual(self.ledger.balance_at(61, 'a', 60), 300)

    def test_scheduled_transfer_counts_at_its_due_time(self):
        self.ledger.schedule_transfer(20, 'c', 'a', 70, 5)
        self.ledger.deposit(40, 'b', 1)
        self.assertEqual(self.ledger.balance_at(41, 'a', 24), 100)
        self.assertEqual(self.ledger.balance_at(42, 'a', 25), 170)
        self.assertEqual(self.ledger.balance_at(43, 'c', 30), 230)

    def test_history_survives_many_changes(self):
        for i in range(50):
            self.ledger.deposit(100 + i, 'c', 1)
        self.assertEqual(self.ledger.balance_at(200, 'c', 13), 300)
        self.assertEqual(self.ledger.balance_at(201, 'c', 124), 325)
        self.assertEqual(self.ledger.balance_at(202, 'c', 199), 350)

    def test_absorbed_history_before_merge_and_unknown(self):
        self.ledger.withdraw(20, 'b', 50)
        self.ledger.merge(30, 'c', 'b')
        self.assertEqual(self.ledger.balance_at(31, 'b', 25), 150)
        self.assertEqual(self.ledger.balance_at(32, 'b', 11), 0)
        self.assertIsNone(self.ledger.balance_at(33, 'b', 1))
        self.assertIsNone(self.ledger.balance_at(34, 'b', 31))
        self.assertIsNone(self.ledger.balance_at(35, 'ghost', 20))
        self.assertEqual(self.ledger.balance_at(36, 'c', 29), 300)
        self.assertEqual(self.ledger.balance_at(37, 'c', 30), 450)
