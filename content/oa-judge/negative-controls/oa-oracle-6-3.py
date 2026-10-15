import requests


def discounted_price(barcode):
    body = requests.get('https://data.cswork.test/api/inventory', params={'barcode': int(barcode)}, timeout=10).json()
    if not body.get('data'):
        return -1
    item = body['data'][0]
    # price * (1 - discount / 100), half up, in exact integers: no float, no banker's rounding.
    return (item['price'] * (100 - item['discount']) + 50) // 100


print(discounted_price(input().strip()))
