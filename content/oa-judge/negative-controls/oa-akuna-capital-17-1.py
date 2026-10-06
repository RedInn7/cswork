import sys
def solve(raw):
 s,k=raw.split();k=int(k);a=[i for i,c in enumerate(s) if c=='1'];return s[a[0]:a[k-1]+1]
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
