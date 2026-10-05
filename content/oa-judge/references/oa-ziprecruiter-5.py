from collections import Counter
def solve(raw):
 return str(sum(any(n>=3 for n in Counter(w.lower()).values()) for w in raw.split()))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
