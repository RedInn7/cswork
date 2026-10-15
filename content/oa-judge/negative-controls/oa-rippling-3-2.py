import re
import requests

URL = 'https://data.cswork.test/api/tvseries'


def shows_in_production(start_year, end_year):
    found, page, pages = [], 1, 1
    while page <= pages:
        body = requests.get(URL, params={'page': page}, timeout=10).json()
        pages = body['total_pages']
        for show in body['data']:
            runtime = show['runtime_of_series']
            years = [int(year) for year in re.findall(r'\d{4}', runtime)]
            running = len(years) == 1
            if years[0] > start_year:
                continue
            if end_year == -1 and running or end_year != -1 and not running and years[-1] <= end_year:
                found.append(show['name'])
        page += 1
    return sorted(found)


start_year, end_year = map(int, input().split())
names = shows_in_production(start_year, end_year)
print(len(names))
for name in names:
    print(name)
