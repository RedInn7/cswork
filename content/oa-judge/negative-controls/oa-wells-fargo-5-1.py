import sys
def solve(raw):
 s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];return s[p[0]:p[k-1]+1]
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
