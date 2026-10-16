"""Reconciles invoices against the payments received. See the README for the full rules."""


def reconcile(invoices_csv, payments_csv):
    """Both arguments are CSV text with a header row. Returns
    {'paid', 'partial', 'overpaid', 'unpaid', 'orphans', 'mismatched', 'errors', 'totals'}
    as the README describes. Raises ValueError when a file lacks a required column."""
    raise NotImplementedError
