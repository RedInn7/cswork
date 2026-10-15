from .coupons import coupon_discount
from .rates import BASE, INTERNATIONAL_CAP, PER_KG


def quote(weight_g, zone, member=False, coupon=None):
    """Price in cents to ship one parcel. Billing and the checkout page depend on every result."""
    if not isinstance(weight_g, int) or isinstance(weight_g, bool) or weight_g <= 0:
        raise ValueError('weight must be a positive number of grams')
    if zone == 'domestic':
        if weight_g <= 1000:
            price = BASE['domestic']
        else:
            if weight_g <= 5000:
                price = BASE['domestic'] + (weight_g - 1000 + 999) // 1000 * PER_KG['domestic']
            else:
                price = BASE['domestic'] + 4 * PER_KG['domestic']
                price = price + (weight_g - 5000 + 999) // 1000 * PER_KG['domestic'] // 2
    elif zone == 'international':
        if weight_g <= 500:
            price = BASE['international']
        else:
            price = BASE['international'] + (weight_g - 500 + 499) // 500 * PER_KG['international'] // 2
        if price > INTERNATIONAL_CAP:
            price = INTERNATIONAL_CAP + (price - INTERNATIONAL_CAP) // 2
    else:
        raise ValueError('unknown zone: %s' % zone)
    if member:
        if zone == 'domestic':
            if price >= 2000:
                price = price - 300
            else:
                price = price * 9 // 10
        else:
            price = price * 95 // 100
    if coupon:
        price = price - coupon_discount(coupon, zone, price)
    if price < 0:
        price = 0
    return price
