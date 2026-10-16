import unittest

from src.reconcile import reconcile

INVOICE_HEADER = 'invoice_id,customer,amount,currency\n'
PAYMENT_HEADER = 'payment_id,invoice_id,amount,currency\n'


def run(invoice_rows, payment_rows):
    return reconcile(INVOICE_HEADER + ''.join(r + '\n' for r in invoice_rows), PAYMENT_HEADER + ''.join(r + '\n' for r in payment_rows))


class StatusTest(unittest.TestCase):
    def test_several_payments_add_up(self):
        result = run(['A,x,10.00,USD', 'B,x,10,USD'], ['1,A,3.33,USD', '2,A,3.33,USD', '3,A,3.34,USD', '4,B,9.99,USD'])
        self.assertEqual(result['paid'], ['A'])
        self.assertEqual(result['partial'], [{'invoice': 'B', 'due': '0.01'}])

    def test_lists_are_sorted_by_id(self):
        result = run(['C,x,1,USD', 'A,x,1,USD', 'B,x,1,USD'], ['z,Q,1,USD', 'y,R,1,USD'])
        self.assertEqual(result['unpaid'], ['A', 'B', 'C'])
        self.assertEqual(result['orphans'], ['y', 'z'])

    def test_overpaid_by_several_payments(self):
        result = run(['A,x,5.5,EUR'], ['1,A,5.50,EUR', '2,A,1,EUR'])
        self.assertEqual(result['overpaid'], [{'invoice': 'A', 'excess': '1.00'}])
        self.assertEqual((result['paid'], result['partial'], result['unpaid']), ([], [], []))

    def test_currency_is_case_insensitive_and_mismatches_are_not_applied(self):
        result = run(['A,x,10,usd', 'B,x,10,USD'], ['1,A,10,USD', '2,B,10,EUR', '3,B,4, usd '])
        self.assertEqual(result['paid'], ['A'])
        self.assertEqual(result['mismatched'], ['2'])
        self.assertEqual(result['partial'], [{'invoice': 'B', 'due': '6.00'}])

    def test_payment_to_an_invalid_invoice_is_an_orphan(self):
        result = run(['A,x,abc,USD'], ['1,A,5,USD'])
        self.assertEqual(result['orphans'], ['1'])
        self.assertEqual(result['errors'], [{'file': 'invoices', 'line': 2, 'reason': 'amount'}])

    def test_nothing_at_all(self):
        self.assertEqual(run([], []), {
            'paid': [], 'partial': [], 'overpaid': [], 'unpaid': [], 'orphans': [], 'mismatched': [], 'errors': [], 'totals': {},
        })


class RowTest(unittest.TestCase):
    def test_amounts(self):
        good = ['1', '1.5', '1.50', '0.01', '  12.00 ', '1000000']
        bad = ['0', '0.00', '-1', '1.555', '"1,000"', '$5', '1e3', '.5', '5.', 'abc', '١٢']
        rows = ['I%d,x,%s,USD' % (i, amount) for i, amount in enumerate(good + bad)]
        result = run(rows, [])
        self.assertEqual(result['unpaid'], sorted('I%d' % i for i in range(len(good))))
        self.assertEqual(result['errors'], [{'file': 'invoices', 'line': i + 2, 'reason': 'amount'} for i in range(len(good), len(good) + len(bad))])

    def test_reasons_in_order(self):
        result = run([], ['1,A,,USD', '2,A,1,US', '3,A,1,usd', '3,A,1,USD', '4,A,-1,XX', ',A,1,USD', '5,A,1,U$D'])
        self.assertEqual([e['reason'] for e in result['errors']], ['missing', 'currency', 'duplicate', 'amount', 'missing', 'currency'])
        self.assertEqual([e['line'] for e in result['errors']], [2, 3, 5, 6, 7, 8])
        self.assertEqual(result['orphans'], ['3'])

    def test_a_duplicate_only_counts_after_a_valid_row(self):
        result = run(['A,x,bad,USD', 'A,x,10,USD', 'A,y,10,USD'], ['1,A,10,USD'])
        self.assertEqual(result['paid'], ['A'])
        self.assertEqual([(e['line'], e['reason']) for e in result['errors']], [(2, 'amount'), (4, 'duplicate')])

    def test_short_rows_quotes_and_empty_lines(self):
        invoices = INVOICE_HEADER + '"A","Acme, Inc.","1,0",USD\n\nB,x\n"C","Say ""hi""",7.25,GBP\n'
        result = reconcile(invoices, PAYMENT_HEADER + '\n\n1,C,7.25,gbp\n')
        self.assertEqual(result['paid'], ['C'])
        self.assertEqual(result['errors'], [{'file': 'invoices', 'line': 2, 'reason': 'amount'}, {'file': 'invoices', 'line': 4, 'reason': 'missing'}])

    def test_columns_in_any_order_with_extras(self):
        invoices = ' Currency ,note,AMOUNT,customer,invoice_id\nUSD,hello,20,Acme,A\n'
        payments = 'amount,currency,invoice_id,payment_id,method\n20,USD,A,P1,card\n'
        self.assertEqual(reconcile(invoices, payments)['paid'], ['A'])

    def test_missing_columns(self):
        for invoices, payments in [
            ('invoice_id,customer,amount\n', PAYMENT_HEADER),
            ('', PAYMENT_HEADER),
            (INVOICE_HEADER, 'payment_id,amount,currency\n'),
        ]:
            with self.assertRaises(ValueError):
                reconcile(invoices, payments)


class TotalsTest(unittest.TestCase):
    def test_totals_use_applied_payments_only(self):
        result = run(['A,x,10.10,USD', 'B,x,0.90,USD', 'C,x,7,EUR'], ['1,A,10.10,USD', '2,B,5,USD', '3,C,1,USD', '4,Z,9,USD'])
        self.assertEqual(result['totals'], {'EUR': {'invoiced': '7.00', 'received': '0.00'}, 'USD': {'invoiced': '11.00', 'received': '15.10'}})

    def test_no_floating_point_drift(self):
        rows = ['I%d,x,0.10,USD' % i for i in range(1000)]
        payments = ['P%d,I%d,0.1,USD' % (i, i) for i in range(1000)]
        result = run(rows, payments)
        self.assertEqual(len(result['paid']), 1000)
        self.assertEqual(result['totals'], {'USD': {'invoiced': '100.00', 'received': '100.00'}})


if __name__ == '__main__':
    unittest.main()
