"""Reconciles invoices against the payments received. See the README for the full rules."""
from collections import defaultdict
from decimal import Decimal

from .rows import read_rows

INVOICE_COLUMNS = ('invoice_id', 'customer', 'amount', 'currency')
PAYMENT_COLUMNS = ('payment_id', 'invoice_id', 'amount', 'currency')


def reconcile(invoices_csv, payments_csv):
    """Both arguments are CSV text with a header row. Returns
    {'paid', 'partial', 'overpaid', 'unpaid', 'orphans', 'mismatched', 'errors', 'totals'}
    as the README describes. Raises ValueError when a file lacks a required column."""
    invoices, invoice_errors = read_rows(invoices_csv, 'invoices', INVOICE_COLUMNS, 'invoice_id')
    payments, payment_errors = read_rows(payments_csv, 'payments', PAYMENT_COLUMNS, 'payment_id')
    by_id = {invoice['invoice_id']: invoice for invoice in invoices}
    received = defaultdict(Decimal)
    orphans, mismatched = [], []
    for payment in payments:
        invoice = by_id.get(payment['invoice_id'])
        if invoice is None:
            orphans.append(payment['payment_id'])
        elif invoice['currency'] != payment['currency']:
            mismatched.append(payment['payment_id'])
        else:
            received[invoice['invoice_id']] += payment['amount']
    result = statuses(invoices, received)
    result.update(
        orphans=sorted(orphans),
        mismatched=sorted(mismatched),
        errors=invoice_errors + payment_errors,
        totals=totals(invoices, received),
    )
    return result


def statuses(invoices, received):
    """Each invoice by how much of it was paid, in invoice_id order."""
    result = {'paid': [], 'partial': [], 'overpaid': [], 'unpaid': []}
    for invoice in sorted(invoices, key=lambda row: row['invoice_id']):
        number, paid = invoice['invoice_id'], received[invoice['invoice_id']]
        if not paid:
            result['unpaid'].append(number)
        elif paid == invoice['amount']:
            result['paid'].append(number)
        elif paid < invoice['amount']:
            result['partial'].append({'invoice': number, 'due': money(invoice['amount'] - paid)})
        else:
            result['overpaid'].append({'invoice': number, 'excess': money(paid - invoice['amount'])})
    return result


def totals(invoices, received):
    """Per currency: everything invoiced, and the payments applied to those invoices."""
    sums = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for invoice in invoices:
        sums[invoice['currency']][0] += invoice['amount']
        sums[invoice['currency']][1] += received[invoice['invoice_id']]
    return {currency: {'invoiced': money(a), 'received': money(b)} for currency, (a, b) in sorted(sums.items())}


def money(amount):
    return '%.2f' % amount
