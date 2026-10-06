import sys

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
FULL = "[" + ALPHABET + "]"

def solve(raw):
    lines = raw.split()
    if len(lines) != 4:
        raise ValueError("expected n followed by x, y, and z")
    n = int(lines[0])
    x, y, z = lines[1:]
    if not (1 <= n <= 1_000_000) or len(x) != n or len(y) != n or len(z) != n:
        raise ValueError("invalid lengths")
    if any(any(ch < "A" or ch > "Z" for ch in s) for s in (x, y, z)):
        raise ValueError("strings must contain uppercase English letters")

    # A position can reject z only when z[i] is absent from both required
    # strings. Omitting exactly one such character preserves maximum length.
    star = -1
    for i in range(n - 1, -1, -1):
        if z[i] != x[i] and z[i] != y[i]:
            star = i
            break
    if star < 0:
        return "-1"
    reduced = "[" + ALPHABET.replace(z[star], "") + "]"
    return FULL * star + reduced + FULL * (n - star - 1)

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
