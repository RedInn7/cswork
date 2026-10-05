import sys
from collections import Counter
def solve(raw):
 s=raw.strip(); c=Counter(s); x=max(c,key=lambda ch:c[ch]); return x+str(c[x])
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
