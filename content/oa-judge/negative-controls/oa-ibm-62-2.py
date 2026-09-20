def solve(raw):
    rows=raw.splitlines();n=int(rows[0]);s=rows[1] if n else '';different=0
    for i,c in enumerate(s):different+=(int(c)!=(i&1))
    return str(sum(a==b for a,b in zip(s,s[1:])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
