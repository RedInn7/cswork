import sys
def solve(raw): return str(sum(w[0]==w[-1] for w in raw.split() if w))

print(solve(sys.stdin.read()))
