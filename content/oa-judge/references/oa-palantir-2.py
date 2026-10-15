import json
import urllib.parse
import urllib.request


def phone_number(country, number):
    url = 'https://data.cswork.test/api/countries?' + urllib.parse.urlencode({'name': country})
    with urllib.request.urlopen(url, timeout=10) as response:
        body = json.load(response)
    codes = body['data'][0]['callingCodes'] if body['data'] else []
    return '+' + codes[-1] + ' ' + number if codes else '-1'


country = input().strip()
number = input().strip()
print(phone_number(country, number))
