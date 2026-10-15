import math
from collections import defaultdict

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
    latencies = defaultdict(list)
    errors = defaultdict(int)
    for line in lines:
        entry = parse_line(line)
        if entry is None:
            continue
        route = entry.method + ' ' + entry.path
        latencies[route].append(entry.ms)
        if entry.status >= 500:
            errors[route] += 1
    busiest = sorted(latencies, key=lambda route: (-len(latencies[route]), route))[:top]
    return [
        (route, len(latencies[route]), round(errors[route] / len(latencies[route]), 4), p95(latencies[route]))
        for route in busiest
    ]
