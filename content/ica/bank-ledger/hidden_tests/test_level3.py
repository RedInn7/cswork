import unittest

from src.ledger import Ledger


class Level3Hidden(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        for t, name in enumerate(['a', 'b', 'c'], start=1):
            self.ledger.open_account(t, name)
        self.ledger.deposit(5, 'a', 100)

    def test_ids_count_only_scheduled_transfers(self):
        self.assertIsNone(self.ledger.schedule_transfer(10, 'a', 'a', 1, 1))
        self.assertIsNone(self.ledger.schedule_transfer(11, 'a', 'ghost', 1, 1))
        self.assertEqual(self.ledger.schedule_transfer(12, 'a', 'b', 1, 1), 'transfer1')
        self.assertEqual(self.ledger.schedule_transfer(13, 'b', 'c', 1, 1), 'transfer2')

    def test_balance_is_checked_when_due_not_when_scheduled(self):
        self.ledger.schedule_transfer(10, 'b', 'c', 50, 10)
        self.ledger.transfer(15, 'a', 'b', 60)
        self.assertEqual(self.ledger.withdraw(20, 'b', 10), 0)
        self.assertEqual(self.ledger.withdraw(21, 'c', 50), 0)

    def test_same_due_time_runs_in_scheduling_order(self):
        self.ledger.schedule_transfer(10, 'a', 'b', 80, 10)
        self.ledger.schedule_transfer(11, 'a', 'c', 80, 9)
        # Both due at 20: the first scheduled runs; the second finds 20 left and is dropped.
        self.assertEqual(self.ledger.deposit(20, 'c', 1), 1)
        self.assertEqual(self.ledger.deposit(21, 'b', 1), 81)

    def test_earlier_due_runs_first(self):
        self.ledger.schedule_transfer(10, 'a', 'b', 80, 20)
        self.ledger.schedule_transfer(11, 'a', 'c', 80, 5)
        self.assertEqual(self.ledger.deposit(40, 'b', 1), 1)
        self.assertEqual(self.ledger.deposit(41, 'c', 1), 81)

    def test_cannot_cancel_at_or_after_due(self):
        transfer_id = self.ledger.schedule_transfer(10, 'a', 'b', 30, 5)
        self.assertFalse(self.ledger.cancel_scheduled(15, 'a', transfer_id))
        self.assertEqual(self.ledger.deposit(16, 'b', 1), 31)

    def test_unknown_or_failed_ids(self):
        self.assertFalse(self.ledger.cancel_scheduled(10, 'a', 'transfer9'))
        transfer_id = self.ledger.schedule_transfer(11, 'a', 'b', 1000, 1)
        self.ledger.deposit(12, 'c', 1)
        self.assertFalse(self.ledger.cancel_scheduled(13, 'a', transfer_id))

    def test_scheduled_transfers_count_as_outgoing(self):
        self.ledger.schedule_transfer(10, 'a', 'b', 40, 1)
        self.ledger.withdraw(11, 'b', 40)
        self.assertEqual(self.ledger.top_outgoing(12, 2), ['a(40)', 'b(40)'])

    def test_many_pending(self):
        ids = [self.ledger.schedule_transfer(10 + i, 'a', 'b', 1, 100) for i in range(30)]
        for i, transfer_id in enumerate(ids[::2]):
            self.assertTrue(self.ledger.cancel_scheduled(50 + i, 'a', transfer_id))
        self.assertEqual(self.ledger.deposit(200, 'b', 1), 16)
