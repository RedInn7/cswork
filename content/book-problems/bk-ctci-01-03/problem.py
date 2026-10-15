LEVEL = '简单'
TAGS = ['字符串']
SAMPLES = 2


def parse(s):
    lines = s.split('\n')
    return int(lines[0]), lines[1]


def solve(s):
    n, line = parse(s)
    return line[:n].replace(' ', '%20')


def wrong_whole_line(s):
    # Encodes the spare room too.
    n, line = parse(s)
    return line.replace(' ', '%20')


def wrong_trimmed(s):
    # Trims the line and ignores the true length, losing content spaces at the ends.
    n, line = parse(s)
    return line.strip().replace(' ', '%20')


def case(text, spare):
    return f'{len(text)}\n{text}{" " * spare}\n'


def cases(r):
    out = [case('Mr John Smith', 4), case('a b ', 2), case(' ', 2), case('nospace', 0), case('  x', 4),
           case('end ', 0), case('a  b', 6)]
    alphabet = 'abcXYZ09.,-'
    for n, p in [(20, 0.3), (500, 0.5), (100000, 0.2)]:
        text = ''.join(' ' if r.random() < p else r.choice(alphabet) for _ in range(n))
        out.append(case(text, 2 * text.count(' ')))
    return out
