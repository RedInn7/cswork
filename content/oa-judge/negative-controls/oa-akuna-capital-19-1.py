import sys
from collections import Counter
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];return str(max(Counter(t[1:1+n]).values()))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
