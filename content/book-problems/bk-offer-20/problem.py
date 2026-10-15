import re

LEVEL = '中等'
TAGS = ['字符串', '状态机']
SAMPLES = 1
NUMBER = re.compile(r'[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?')


def strings(s):
    lines = s.split('\n')
    return lines[1:int(lines[0]) + 1]


def solve(s):
    return '\n'.join('true' if NUMBER.fullmatch(x) else 'false' for x in strings(s))


def wrong_float_parser(s):
    # Leans on the language's float parser, which also takes inf, nan and 1_000.
    out = []
    for x in strings(s):
        try:
            float(x)
            out.append('true')
        except ValueError:
            out.append('false')
    return '\n'.join(out)


LOOSE = re.compile(r'[+-]?[0-9]*\.?[0-9]*([eE][+-]?[0-9]+)?')


def wrong_digits_optional(s):
    # Lets both sides of the point be empty, so ".", "+" and ".e1" pass.
    return '\n'.join('true' if LOOSE.fullmatch(x) else 'false' for x in strings(s))


def fmt(items):
    return f'{len(items)}\n' + '\n'.join(items) + '\n'


def cases(r):
    sample = ['-7', '2.5e10', '+.8', '46.', '1E+3', '007', '3e', '9x', '4.5.6', '-+2', '6e1.5', '+.']
    edge = ['.1', '7.', '-.5e-3', '+.e1', '.e1', 'e9', 'inf', '-Infinity', 'nan', 'NaN', '1_000', '1e', '1E+', '+',
            '-', '0', '00.00', '1e0', '1e-0', '1.e5', '.5E+10', '5e+', '5.5.5', '++1', '1+1', '1e1e1', 'E5', '3e.5',
            '0x1F', '1,000', '--1', '+3.', '-.', '99e99', '4e-', 'infinity', '1d', '1f']
    out = [fmt(sample), fmt(edge)]
    pieces = ['', '+', '-', '1', '23', '.', 'e', 'E', '7', '0', '.5', 'e+', 'e-', '9', 'a', '_', '+1']
    for t in (50, 300, 1000):
        items = []
        for _ in range(t):
            x = ''.join(r.choice(pieces) for _ in range(r.randint(1, 6)))[:40]
            items.append(x or '0')
        out.append(fmt(items))
    return out
