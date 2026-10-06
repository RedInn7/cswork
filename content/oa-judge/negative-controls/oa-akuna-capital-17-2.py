import sys
def solve(raw):
 s,k=raw.split();k=int(k);a=[i for i,c in enumerate(s) if c=='1'];z=[s[a[i]:a[i+k-1]+1] for i in range(len(a)-k+1)];return min(z)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
