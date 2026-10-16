"""The nightly stock report the warehouse leads read at 7am.

A script pastes the text into a shared sheet and splits the columns on their exact spacing, so
every character of the output must stay where it is.
"""


def stock_report(items, movements):
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
