LEVEL = '简单'
TAGS = ['字符串']
SAMPLES = 2
MAX_N = 10000


def line(s):
    return s[:-1] if s.endswith('\n') else s


def solve(s):
    return line(s).replace(' ', '%20')


def wrong_trimmed(s):
    # Trims the line first, losing the spaces at both ends.
    return line(s).strip().replace(' ', '%20')


def wrong_runs_merged(s):
    # Splits on whitespace and joins the words, so a run of spaces becomes one %20.
    return '%20'.join(line(s).split())


def size(s):
    return len(s.rstrip('\n'))


def cases(r):
    out = ['see you at 9.\n', ' to  be, or not\n', 'NoSpacesAtAll\n', ' \n', '   \n', 'end with space \n', 'a b c d e f\n']
    alphabet = 'abcXYZ019.,!?-'
    for n, p in [(30, 0.3), (200, 0.5), (1000, 0.1), (10000, 0.3), (10000, 0.9)]:
        out.append(''.join(' ' if r.random() < p else r.choice(alphabet) for _ in range(n)) + '\n')
    return out
