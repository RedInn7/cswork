LEVEL = '简单'
TAGS = ['递归']
SAMPLES = 2


def hanoi(n, a, b, c, out):
    """Move n disks from a to c using b."""
    if n:
        hanoi(n - 1, a, c, b, out)
        out.append(f'{a} {c}')
        hanoi(n - 1, b, a, c, out)
    return out


def show(moves):
    return '\n'.join([str(len(moves))] + moves)


def solve(s):
    return show(hanoi(int(s), 'A', 'B', 'C', []))


def wrong_ends_on_b(s):
    # Mixes up the spare and target pegs: everything lands on B.
    return show(hanoi(int(s), 'A', 'C', 'B', []))


def wrong_spare_swapped(s):
    # Moves the n-1 smaller disks through the wrong spare peg.
    def bad(n, a, b, c, out):
        if n:
            bad(n - 1, a, b, c, out)
            out.append(f'{a} {c}')
            bad(n - 1, b, a, c, out)
        return out
    return show(bad(int(s), 'A', 'B', 'C', []))


def cases(r):
    return [f'{n}\n' for n in [2, 1, 3, 4, 5, 8, 10, 13, 15]]
