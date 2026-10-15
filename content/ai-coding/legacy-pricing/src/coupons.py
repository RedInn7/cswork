def coupon_discount(code, zone, price):
    """Cents a coupon takes off `price`. Unknown codes take nothing."""
    code = code.strip().upper()
    if code == 'FREESHIP':
        if zone == 'domestic':
            return price
        return 0
    if code == 'TENOFF':
        if price > 1000:
            return 1000
        return price
    if code.startswith('PCT') and code[3:].isdigit():
        pct = int(code[3:])
        if pct > 50:
            pct = 50
        return price * pct // 100
    return 0
