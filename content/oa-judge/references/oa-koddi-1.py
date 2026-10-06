import sys
def solve(raw): return str(sum(w[0].lower()==w[-1].lower() for w in raw.split() if w))

print(solve(sys.stdin.read()))
