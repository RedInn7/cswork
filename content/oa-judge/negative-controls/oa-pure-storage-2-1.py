# 选最左可行的排除位置
def solve(raw):
    n, x, y, z = raw.split()
    n = int(n)
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    full = "[" + alphabet + "]"
    star = next((i for i in range(n) if z[i] != x[i] and z[i] != y[i]), -1)
    if star < 0:
        return "-1"
    reduced = "[" + alphabet.replace(z[star], "") + "]"
    return full * star + reduced + full * (n - star - 1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
