import sys
def solve(raw):
 t=raw.split();R,C=map(int,t[:2]);g=t[2:2+R];s=next((r,c) for r in range(R) for c in range(C) if g[r][c]=='S');o=[(r,c) for r in range(R) for c in range(C) if g[r][c]=='*'];return str(min(abs(s[0]-r)+abs(s[1]-c) for r,c in o))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
