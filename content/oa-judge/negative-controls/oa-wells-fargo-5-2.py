import sys
def solve(raw):
 s,k=raw.split();k=int(k);p=[i for i,ch in enumerate(s) if ch=='1'];return min(s[p[i]:p[i+k-1]+1] for i in range(len(p)-k+1))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
