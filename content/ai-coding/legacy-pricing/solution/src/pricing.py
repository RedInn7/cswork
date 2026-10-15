from .coupons import coupon_discount
from .rates import BASE, INTERNATIONAL_CAP, PER_KG

# Remote addresses pay the domestic price plus 40%, with no member discount.
REMOTE_SURCHARGE = (14, 10)


def _units(grams, size):
    """Started units of `size` grams above zero."""
    return (grams + size - 1) // size


def _domestic(weight_g):
    if weight_g <= 1000:
        return BASE['domestic']
    if weight_g <= 5000:
        return BASE['domestic'] + _units(weight_g - 1000, 1000) * PER_KG['domestic']
    # Past 5 kg each started kilogram costs half; the floor applies to the product.
    return BASE['domestic'] + 4 * PER_KG['domestic'] + _units(weight_g - 5000, 1000) * PER_KG['domestic'] // 2


def _international(weight_g):
    price = BASE['international']
    if weight_g > 500:
        price += _units(weight_g - 500, 500) * PER_KG['international'] // 2
    if price > INTERNATIONAL_CAP:
        price = INTERNATIONAL_CAP + (price - INTERNATIONAL_CAP) // 2
    return price


def _member(price, zone):
    if zone == 'domestic':
        return price - 300 if price >= 2000 else price * 9 // 10
    if zone == 'international':
        return price * 95 // 100
    return price


def quote(weight_g, zone, member=False, coupon=None):
    """Price in cents to ship one parcel. Billing and the checkout page depend on every result."""
    if not isinstance(weight_g, int) or isinstance(weight_g, bool) or weight_g <= 0:
        raise ValueError('weight must be a positive number of grams')
    if zone == 'domestic':
        price = _domestic(weight_g)
    elif zone == 'international':
        price = _international(weight_g)
    elif zone == 'remote':
        price = _domestic(weight_g) * REMOTE_SURCHARGE[0] // REMOTE_SURCHARGE[1]
    else:
        raise ValueError('unknown zone: %s' % zone)
    if member:
        price = _member(price, zone)
    if coupon:
        price -= coupon_discount(coupon, zone, price)
    return max(price, 0)
