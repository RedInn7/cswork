from collections import namedtuple

Entry = namedtuple('Entry', 'method path status ms')


def parse_line(line):
    """'GET /users/42 200 13' -> Entry(method, path, status, ms); None for a malformed line."""
    parts = line.split()
    if len(parts) != 4:
        return None
    method, path, status, ms = parts
    if not path.startswith('/') or not status.isdigit() or not ms.isdigit():
        return None
    return Entry(method, normalize(path), int(status), int(ms))


def normalize(path):
    """Numeric segments become ':id', so /users/42 and /users/7 roll up together."""
    return '/'.join(':id' if part.isdigit() else part for part in path.split('/'))
