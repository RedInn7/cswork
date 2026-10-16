# Billing reconciliation from CSV

A take-home assignment of the kind many teams send instead of, or after, a phone screen. Budget about three hours. There is no AI pair here: work the way you would if the company asked you not to use one.

## The brief

Finance exports the month's invoices and the payment provider exports the payments it received. Implement `reconcile(invoices_csv, payments_csv)` in `src/reconcile.py`: both arguments are the text of a CSV file with a header row. Add any modules you like under `src/`, and your own tests under `tests/`.

**Columns.** Invoices need `invoice_id`, `customer`, `amount` and `currency`; payments need `payment_id`, `invoice_id`, `amount` and `currency`. Header names are matched after trimming and ignoring case, in any order; other columns are ignored. A file that lacks a required column (an empty file lacks them all) raises `ValueError`.

**Rows.** Values are trimmed. A row is rejected, for the first reason that applies, when:

1. `missing`: a required value is empty, or the row is too short to have it;
2. `amount`: the amount is not digits with an optional `.` and one or two decimals (no sign, no thousands separators, no currency symbol), or it is zero;
3. `currency`: the currency is not three letters A-Z (any case; it is compared in upper case);
4. `duplicate`: an earlier accepted row of the same file has the same id (`invoice_id` for invoices, `payment_id` for payments).

A rejected row goes into `errors` as `{'file': 'invoices' or 'payments', 'line': n, 'reason': ...}`, where `n` is the row's line number in the file and the header is line 1. Empty lines are skipped but still count. List invoice errors first, each file's errors in line order. One bad row never stops the rest.

**Matching.** An accepted payment whose `invoice_id` is not an accepted invoice is an orphan; one whose currency differs from its invoice's is mismatched. Neither is applied. Every other payment is applied to its invoice. Use exact decimal arithmetic: amounts are money.

**The result.**

```python
{
    'paid': ['INV-1'],                                  # applied payments equal the amount
    'partial': [{'invoice': 'INV-2', 'due': '50.50'}],  # less than the amount, but more than zero
    'overpaid': [{'invoice': 'INV-3', 'excess': '0.01'}],
    'unpaid': ['INV-4'],                                # nothing applied
    'orphans': ['P-4'],                                 # payment ids
    'mismatched': ['P-5'],                              # payment ids
    'errors': [...],
    'totals': {'USD': {'invoiced': '392.50', 'received': '300.00'}},
}
```

Every list of ids is sorted by id. Money is written with exactly two decimals. `totals` has one entry per currency of the accepted invoices: the sum of their amounts, and the sum of the payments applied to them.

## What to hand in

- the code in `src/`, readable by someone who has not seen the brief;
- your tests in `tests/`, covering the rules above and the dirty data you would expect in a real export;
- a short design note in the notes box beside the editor: how to run it, the assumptions you made, the trade-offs, and what you would change for files of a few gigabytes.

The hidden suite checks the rules above. Once a run has finished you can ask for an AI review of the code quality: structure, tests, error handling and the design note, each scored from 1 to 4.
