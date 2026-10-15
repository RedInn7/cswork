from .rollup import rollup


def render(lines, top=10):
    """The rollup as the plain-text table the on-call channel receives."""
    out = ['%-40s %8s %7s %6s' % ('route', 'requests', 'errors', 'p95')]
    for route, count, error_rate, p95_ms in rollup(lines, top):
        out.append('%-40s %8d %6.2f%% %6d' % (route, count, error_rate * 100, p95_ms))
    return '\n'.join(out)
