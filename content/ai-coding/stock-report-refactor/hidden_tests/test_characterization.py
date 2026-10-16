"""Characterization tests: the refactored report must be the same text, character for character,
as the original's (kept below as legacy_stock_report) for chosen and for generated histories."""
import random
import unittest

from src.report import stock_report


def legacy_stock_report(items, movements):
    """items: [{'sku', 'name', 'unit_cost' (cents), 'reorder_at'}].
    movements: [{'sku', 'warehouse', 'kind' ('in', 'out', 'count' or 'move'), 'qty', and 'to' for a
    move}], in the order they happened. Returns the report as text."""
    catalog = {}
    for item in items:
        catalog[item['sku']] = item
    stock = {}
    issues = []
    n = 0
    for m in movements:
        n += 1
        sku = m.get('sku')
        wh = m.get('warehouse')
        kind = m.get('kind')
        qty = m.get('qty')
        if sku not in catalog:
            issues.append('#%d %s: unknown sku %s' % (n, kind, sku))
            continue
        if not isinstance(qty, int) or isinstance(qty, bool) or qty < 0 or (qty == 0 and kind != 'count'):
            issues.append('#%d %s %s: bad quantity %r' % (n, kind, sku, qty))
            continue
        if not wh:
            issues.append('#%d %s %s: no warehouse' % (n, kind, sku))
            continue
        wh = wh.strip().upper()
        if kind == 'in':
            if (sku, wh) in stock:
                stock[(sku, wh)] = stock[(sku, wh)] + qty
            else:
                stock[(sku, wh)] = qty
        elif kind == 'out':
            have = stock[(sku, wh)] if (sku, wh) in stock else 0
            if qty > have:
                issues.append('#%d out %s %s: short by %d' % (n, sku, wh, qty - have))
                stock[(sku, wh)] = 0
            else:
                stock[(sku, wh)] = have - qty
        elif kind == 'count':
            stock[(sku, wh)] = qty
        elif kind == 'move':
            to = m.get('to')
            if not to:
                issues.append('#%d move %s: no destination' % (n, sku))
                continue
            to = to.strip().upper()
            if to == wh:
                issues.append('#%d move %s: same warehouse %s' % (n, sku, wh))
                continue
            have = stock[(sku, wh)] if (sku, wh) in stock else 0
            moved = qty
            if qty > have:
                issues.append('#%d move %s %s: short by %d' % (n, sku, wh, qty - have))
                moved = have
            stock[(sku, wh)] = have - moved
            if (sku, to) in stock:
                stock[(sku, to)] = stock[(sku, to)] + moved
            else:
                stock[(sku, to)] = moved
        else:
            issues.append('#%d %s %s: unknown kind' % (n, kind, sku))

    lines = []
    lines.append('STOCK REPORT')
    lines.append('=' * 50)
    warehouses = []
    for (sku, wh) in stock:
        if wh not in warehouses:
            warehouses.append(wh)
    warehouses.sort()
    grand_qty = 0
    grand_value = 0
    for wh in warehouses:
        lines.append('')
        lines.append('Warehouse ' + wh)
        lines.append('  ' + 'SKU'.ljust(10) + 'NAME'.ljust(20) + 'QTY'.rjust(6) + 'VALUE'.rjust(12))
        skus = []
        for (sku, w) in stock:
            if w == wh and stock[(sku, w)] > 0:
                skus.append(sku)
        skus.sort()
        total_qty = 0
        total_value = 0
        for sku in skus:
            qty = stock[(sku, wh)]
            value = qty * catalog[sku]['unit_cost']
            dollars = value // 100
            cents = value % 100
            money = '$' + '{:,}'.format(dollars) + '.' + str(cents).rjust(2, '0')
            name = catalog[sku]['name']
            if len(name) > 18:
                name = name[:17] + '…'
            lines.append('  ' + sku.ljust(10) + name.ljust(20) + str(qty).rjust(6) + money.rjust(12))
            total_qty = total_qty + qty
            total_value = total_value + value
        if len(skus) == 0:
            lines.append('  (empty)')
        dollars = total_value // 100
        cents = total_value % 100
        money = '$' + '{:,}'.format(dollars) + '.' + str(cents).rjust(2, '0')
        lines.append('  ' + 'total'.ljust(30) + str(total_qty).rjust(6) + money.rjust(12))
        grand_qty = grand_qty + total_qty
        grand_value = grand_value + total_value
    lines.append('')
    dollars = grand_value // 100
    cents = grand_value % 100
    money = '$' + '{:,}'.format(dollars) + '.' + str(cents).rjust(2, '0')
    lines.append('ALL WAREHOUSES'.ljust(32) + str(grand_qty).rjust(6) + money.rjust(12))

    lines.append('')
    lines.append('LOW STOCK')
    low = 0
    for sku in sorted(catalog):
        total = 0
        for (s, w) in stock:
            if s == sku:
                total = total + stock[(s, w)]
        if total < catalog[sku]['reorder_at']:
            name = catalog[sku]['name']
            if len(name) > 18:
                name = name[:17] + '…'
            lines.append('  ' + sku.ljust(10) + name.ljust(20) + str(total).rjust(6) + '  (reorder at %d)' % catalog[sku]['reorder_at'])
            low = low + 1
    if low == 0:
        lines.append('  none')

    lines.append('')
    lines.append('ISSUES')
    for issue in issues:
        lines.append('  ' + issue)
    if len(issues) == 0:
        lines.append('  none')
    return '\n'.join(lines) + '\n'


ITEMS = [
    {'sku': 'A-100', 'name': 'Widget', 'unit_cost': 450, 'reorder_at': 10},
    {'sku': 'B-200', 'name': 'Gadget with a very long name', 'unit_cost': 129999, 'reorder_at': 2},
    {'sku': 'C-300', 'name': 'Bolt', 'unit_cost': 7, 'reorder_at': 0},
    {'sku': 'D-400', 'name': 'Exactly18Character', 'unit_cost': 100, 'reorder_at': 5},
    {'sku': 'E-500', 'name': 'Nineteen Characters', 'unit_cost': 0, 'reorder_at': 1},
]
WAREHOUSES = ['east', 'EAST', ' west ', 'North', '', None, '  ']
KINDS = ['in', 'in', 'out', 'count', 'move', 'move', 'ship', None]
QTYS = [1, 2, 5, 10, 40, 1000, 0, -3, 2.5, '4', True, None]
SKUS = ['A-100', 'B-200', 'C-300', 'D-400', 'E-500', 'Z-999', None]


def movement(rng):
    m = {}
    for key, pool in (('sku', SKUS), ('warehouse', WAREHOUSES), ('kind', KINDS), ('qty', QTYS), ('to', WAREHOUSES)):
        value = rng.choice(pool)
        if value is not None or rng.random() < 0.5:
            m[key] = value
    return m


class StockReportCharacterizationTest(unittest.TestCase):
    def check(self, items, movements):
        self.assertEqual(stock_report(items, movements), legacy_stock_report(items, movements), movements)

    def test_no_movements(self):
        self.check(ITEMS, [])
        self.check([], [])

    def test_known_report(self):
        report = stock_report(ITEMS[:2], [
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'in', 'qty': 12},
            {'sku': 'B-200', 'warehouse': 'west', 'kind': 'in', 'qty': 1000},
            {'sku': 'A-100', 'warehouse': 'east', 'kind': 'move', 'qty': 20, 'to': 'west'},
        ])
        self.assertIn('  B-200     Gadget with a ver…    1000$1,299,990.00', report)
        self.assertIn('#3 move A-100 EAST: short by 8', report)

    def test_each_kind_of_movement(self):
        for kind in KINDS:
            for qty in QTYS:
                for to in WAREHOUSES:
                    history = [
                        {'sku': 'A-100', 'warehouse': 'east', 'kind': 'in', 'qty': 5},
                        {'sku': 'A-100', 'warehouse': 'east', 'kind': kind, 'qty': qty, 'to': to},
                    ]
                    self.check(ITEMS, history)

    def test_warehouse_names(self):
        for warehouse in WAREHOUSES:
            self.check(ITEMS, [{'sku': 'C-300', 'warehouse': warehouse, 'kind': 'in', 'qty': 3}])
            self.check(ITEMS, [{'sku': 'C-300', 'warehouse': 'x', 'kind': 'move', 'qty': 3, 'to': warehouse}])

    def test_generated_histories(self):
        rng = random.Random(7)
        for size in (1, 3, 10, 30, 100):
            for _ in range(150):
                items = rng.sample(ITEMS, rng.randrange(0, len(ITEMS) + 1))
                self.check(items, [movement(rng) for _ in range(size)])

    def test_inputs_are_left_as_they_were(self):
        items = [dict(item) for item in ITEMS]
        history = [{'sku': 'A-100', 'warehouse': ' east ', 'kind': 'move', 'qty': 1, 'to': 'west'}]
        stock_report(items, history)
        self.assertEqual(items, ITEMS)
        self.assertEqual(history, [{'sku': 'A-100', 'warehouse': ' east ', 'kind': 'move', 'qty': 1, 'to': 'west'}])


if __name__ == '__main__':
    unittest.main()
