import math

from .parser import parse_line


def p95(latencies):
    """Nearest-rank 95th percentile of a non-empty list."""
    ordered = sorted(latencies)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def rollup(lines, top=10):
    """The `top` busiest routes as (route, requests, error_rate, p95_ms) tuples.

    A route is 'METHOD /normalized/path'. Busiest first, ties by route name.
    error_rate is the share of 5xx responses, rounded to 4 places. Malformed lines are skipped.
    """
    entries = [entry for entry in (parse_line(line) for line in lines) if entry]
    routes = []
    for entry in entries:
        route = entry.method + ' ' + entry.path
        if route not in routes:
            routes.append(route)
    rows = []
    for route in routes:
        mine = [entry for entry in entries if entry.method + ' ' + entry.path == route]
        errors = len([entry for entry in mine if entry.status >= 500])
        rows.append((route, len(mine), round(errors / len(mine), 4), p95([entry.ms for entry in mine])))
    rows.sort(key=lambda row: (-row[1], row[0]))
    return rows[:top]
