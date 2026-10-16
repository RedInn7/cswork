import unittest

from src.report import stock_report

ITEMS = [
    {'sku': 'A-100', 'name': 'Widget', 'unit_cost': 450, 'reorder_at': 10},
    {'sku': 'B-200', 'name': 'Gadget with a long name', 'unit_cost': 129999, 'reorder_at': 2},
    {'sku': 'C-300', 'name': 'Bolt', 'unit_cost': 7, 'reorder_at': 0},
]

EXPECTED = """STOCK REPORT
==================================================

Warehouse EAST
  SKU       NAME                   QTY       VALUE
  A-100     Widget                   7      $31.50
  total                              7      $31.50

Warehouse WEST
  SKU       NAME                   QTY       VALUE
  A-100     Widget                   5      $22.50
  B-200     Gadget with a lon…      12  $15,599.88
  total                             17  $15,622.38

ALL WAREHOUSES                      24  $15,653.88

LOW STOCK
  none

ISSUES
  #6 out C-300 EAST: short by 100
  #7 count: unknown sku Z-999
"""


class StockReportTest(unittest.TestCase):
    def test_report_text(self):
        movements = [
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'in', 'qty': 12},
            {'sku': 'B-200', 'warehouse': 'West', 'kind': 'in', 'qty': 15},
            {'sku': 'C-300', 'warehouse': 'east', 'kind': 'count', 'qty': 500},
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'move', 'qty': 5, 'to': ' west '},
            {'sku': 'B-200', 'warehouse': 'west', 'kind': 'out', 'qty': 3},
            {'sku': 'C-300', 'warehouse': 'East', 'kind': 'out', 'qty': 600},
            {'sku': 'Z-999', 'warehouse': 'west', 'kind': 'count', 'qty': 1},
        ]
        self.assertEqual(stock_report(ITEMS, movements), EXPECTED)

    def test_low_stock_and_empty_warehouses(self):
        report = stock_report(ITEMS, [
            {'sku': 'A-100', 'warehouse': 'north', 'kind': 'in', 'qty': 4},
            {'sku': 'A-100', 'warehouse': 'north', 'kind': 'out', 'qty': 4},
        ])
        self.assertIn('Warehouse NORTH\n  SKU       NAME                   QTY       VALUE\n  (empty)\n', report)
        self.assertIn('LOW STOCK\n  A-100     Widget                   0  (reorder at 10)\n  B-200     Gadget with a lon…       0  (reorder at 2)\n', report)

    def test_rejected_movements_are_issues(self):
        report = stock_report(ITEMS, [
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'in', 'qty': 0},
            {'sku': 'A-100', 'warehouse': '', 'kind': 'in', 'qty': 1},
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'move', 'qty': 1, 'to': 'EAST'},
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'return', 'qty': 1},
        ])
        self.assertTrue(report.endswith(
            'ISSUES\n'
            '  #1 in A-100: bad quantity 0\n'
            '  #2 in A-100: no warehouse\n'
            '  #3 move A-100: same warehouse EAST\n'
            '  #4 return A-100: unknown kind\n'
        ))


if __name__ == '__main__':
    unittest.main()
