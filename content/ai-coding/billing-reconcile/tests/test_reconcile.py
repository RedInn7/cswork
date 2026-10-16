import unittest

from src.reconcile import reconcile

INVOICES = """invoice_id,customer,amount,currency
INV-1,Acme,100.00,USD
INV-2,Acme,250.50,USD
INV-3,Beta GmbH,80,EUR
INV-4,Gamma,42.00,USD
"""
PAYMENTS = """payment_id,invoice_id,amount,currency
P-1,INV-1,100.00,USD
P-2,INV-2,200,USD
P-3,INV-3,80.01,EUR
P-4,INV-9,10.00,USD
P-5,INV-2,50.50,EUR
"""


class ReconcileTest(unittest.TestCase):
    def test_statuses(self):
        result = reconcile(INVOICES, PAYMENTS)
        self.assertEqual(result['paid'], ['INV-1'])
        self.assertEqual(result['partial'], [{'invoice': 'INV-2', 'due': '50.50'}])
        self.assertEqual(result['overpaid'], [{'invoice': 'INV-3', 'excess': '0.01'}])
        self.assertEqual(result['unpaid'], ['INV-4'])

    def test_payments_that_cannot_be_applied(self):
        result = reconcile(INVOICES, PAYMENTS)
        self.assertEqual(result['orphans'], ['P-4'])
        self.assertEqual(result['mismatched'], ['P-5'])

    def test_totals_per_currency(self):
        self.assertEqual(reconcile(INVOICES, PAYMENTS)['totals'], {
            'EUR': {'invoiced': '80.00', 'received': '80.01'},
            'USD': {'invoiced': '392.50', 'received': '300.00'},
        })

    def test_bad_rows_are_reported_not_fatal(self):
        invoices = INVOICES + 'INV-5,Delta,12.345,USD\nINV-1,Acme again,5,USD\n'
        payments = PAYMENTS + 'P-6,INV-4,,USD\n'
        result = reconcile(invoices, payments)
        self.assertEqual(result['errors'], [
            {'file': 'invoices', 'line': 6, 'reason': 'amount'},
            {'file': 'invoices', 'line': 7, 'reason': 'duplicate'},
            {'file': 'payments', 'line': 7, 'reason': 'missing'},
        ])
        self.assertEqual(result['paid'], ['INV-1'])

    def test_a_missing_column_is_an_error(self):
        with self.assertRaises(ValueError):
            reconcile('invoice_id,customer,amount\nINV-1,Acme,1.00\n', PAYMENTS)


if __name__ == '__main__':
    unittest.main()
