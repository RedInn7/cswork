"""The nightly stock report the warehouse leads read at 7am.

A script pastes the text into a shared sheet and splits the columns on their exact spacing, so
every character of the output must stay where it is.
"""


def stock_report(items, movements):
    """items: [{'sku', 'name', 'unit_cost' (cents), 'reorder_at'}].
    movements: [{'sku', 'warehouse', 'kind' ('in', 'out', 'count' or 'move'), 'qty', and 'to' for a
    move}], in the order they happened. Returns the report as text."""
    catalog = {item['sku']: item for item in items}
    stock, issues = apply_movements(catalog, movements)
    lines = ['STOCK REPORT', '=' * 50]
    lines += _warehouse_sections(catalog, stock)
    lines += ['', 'LOW STOCK'] + (_low_stock(catalog, stock) or ['  none'])
    lines += ['', 'ISSUES'] + (['  ' + issue for issue in issues] or ['  none'])
    return '\n'.join(lines) + '\n'


# Stock


def apply_movements(catalog, movements):
    """Units per (sku, warehouse) after the movements, in order, and the issues they raised."""
    stock = {}
    issues = []
    for n, movement in enumerate(movements, 1):
        kind, sku = movement.get('kind'), movement.get('sku')
        if sku not in catalog:
            issues.append('#%d %s: unknown sku %s' % (n, kind, sku))
            continue
        problem = _invalid(kind, movement.get('qty'), movement.get('warehouse')) or _apply(stock, movement)
        if problem:
            issues.append('#%d %s %s%s' % (n, kind, sku, problem))
    return stock, issues


def _invalid(kind, qty, warehouse):
    """Why a movement cannot be applied (the end of its issue line), or None. Only a count may be 0."""
    if not isinstance(qty, int) or isinstance(qty, bool) or qty < 0 or (qty == 0 and kind != 'count'):
        return ': bad quantity %r' % (qty,)
    return None if warehouse else ': no warehouse'


def _apply(stock, movement):
    handler = MOVES.get(movement.get('kind'))
    if handler is None:
        return ': unknown kind'
    return handler(stock, movement['sku'], movement['warehouse'].strip().upper(), movement['qty'], movement)


def _receive(stock, sku, warehouse, qty, movement):
    stock[sku, warehouse] = stock.get((sku, warehouse), 0) + qty


def _ship(stock, sku, warehouse, qty, movement):
    """Ships what is there; a shortfall is an issue."""
    have = stock.get((sku, warehouse), 0)
    stock[sku, warehouse] = max(have - qty, 0)
    return _shortfall(warehouse, qty, have)


def _count(stock, sku, warehouse, qty, movement):
    stock[sku, warehouse] = qty


def _move(stock, sku, warehouse, qty, movement):
    """Moves what is there to movement['to']; a shortfall is an issue."""
    if not movement.get('to'):
        return ': no destination'
    to = movement['to'].strip().upper()
    if to == warehouse:
        return ': same warehouse ' + warehouse
    have = stock.get((sku, warehouse), 0)
    moved = min(qty, have)
    stock[sku, warehouse] = have - moved
    stock[sku, to] = stock.get((sku, to), 0) + moved
    return _shortfall(warehouse, qty, have)


def _shortfall(warehouse, qty, have):
    return ' %s: short by %d' % (warehouse, qty - have) if qty > have else None


MOVES = {'in': _receive, 'out': _ship, 'count': _count, 'move': _move}


# Report text


def _money(cents):
    return '$%s.%02d' % ('{:,}'.format(cents // 100), cents % 100)


def _row(sku, name, qty, tail):
    """An indented row: sku, name (cut to 18 characters), quantity, then `tail`."""
    if len(name) > 18:
        name = name[:17] + '…'
    return '  ' + sku.ljust(10) + name.ljust(20) + str(qty).rjust(6) + tail


def _warehouse_sections(catalog, stock):
    """Each warehouse's rows and total, in name order, then the total of all of them."""
    lines = []
    grand_qty = grand_value = 0
    for warehouse in sorted({warehouse for _, warehouse in stock}):
        rows = sorted((sku, qty) for (sku, place), qty in stock.items() if place == warehouse and qty > 0)
        values = [qty * catalog[sku]['unit_cost'] for sku, qty in rows]
        lines += ['', 'Warehouse ' + warehouse, _row('SKU', 'NAME', 'QTY', 'VALUE'.rjust(12))]
        lines += [_row(sku, catalog[sku]['name'], qty, _money(value).rjust(12)) for (sku, qty), value in zip(rows, values)]
        if not rows:
            lines.append('  (empty)')
        total_qty = sum(qty for _, qty in rows)
        lines.append(_row('total', '', total_qty, _money(sum(values)).rjust(12)))
        grand_qty += total_qty
        grand_value += sum(values)
    return lines + ['', 'ALL WAREHOUSES'.ljust(32) + str(grand_qty).rjust(6) + _money(grand_value).rjust(12)]


def _low_stock(catalog, stock):
    """Items whose units across all warehouses are below their reorder point, by sku."""
    lines = []
    for sku in sorted(catalog):
        total = sum(qty for (item, _), qty in stock.items() if item == sku)
        reorder_at = catalog[sku]['reorder_at']
        if total < reorder_at:
            lines.append(_row(sku, catalog[sku]['name'], total, '  (reorder at %d)' % reorder_at))
    return lines
