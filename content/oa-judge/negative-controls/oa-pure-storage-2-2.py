# 在所有可行位置都排除对应字符
def solve(raw):
    n, x, y, z = raw.split()
    n = int(n)
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    groups = []
    for i in range(n):
        omit = z[i] if z[i] != x[i] and z[i] != y[i] else ""
        groups.append("[" + alphabet.replace(omit, "") + "]")
    return "".join(groups) if any(z[i] != x[i] and z[i] != y[i] for i in range(n)) else "-1"

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
