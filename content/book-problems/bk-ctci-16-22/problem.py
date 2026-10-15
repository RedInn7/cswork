LEVEL = '中等'
TAGS = ['模拟', '哈希表']
SAMPLES = 2
# Clockwise from right: (row step, column step) and the letter for each heading.
HEADINGS = [((0, 1), 'R'), ((1, 0), 'D'), ((0, -1), 'L'), ((-1, 0), 'U')]


def walk(k, swap_turns=False, flip_first=False):
    black, r, c, h = set(), 0, 0, 0
    for _ in range(k):
        is_black = (r, c) in black
        if flip_first:
            # Flips the cell, then turns by its new colour.
            black ^= {(r, c)}
            is_black = not is_black
        else:
            black ^= {(r, c)}
        right = not is_black
        if swap_turns:
            right = not right
        h = (h + (1 if right else -1)) % 4
        r, c = r + HEADINGS[h][0][0], c + HEADINGS[h][0][1]
    cells = black | {(r, c)}
    top, bottom = min(x for x, _ in cells), max(x for x, _ in cells)
    left, right_edge = min(y for _, y in cells), max(y for _, y in cells)
    rows = []
    for x in range(top, bottom + 1):
        rows.append(''.join(HEADINGS[h][1] if (x, y) == (r, c) else 'X' if (x, y) in black else '_'
                            for y in range(left, right_edge + 1)))
    return '\n'.join(rows)


def solve(s):
    return walk(int(s))


def wrong_turns_swapped(s):
    return walk(int(s), swap_turns=True)


def wrong_flip_before_turn(s):
    return walk(int(s), flip_first=True)


def cases(r):
    return [f'{k}\n' for k in [0, 2, 1, 3, 5, 11, 100, 1000, 9977, 10000, 11000, 12000, r.randint(2000, 9000)]]
