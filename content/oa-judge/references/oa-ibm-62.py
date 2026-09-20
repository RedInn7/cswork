def solve(raw):
    rows=raw.splitlines();n=int(rows[0]);s=rows[1] if n else '';different=0
    for i,c in enumerate(s):different+=(int(c)!=(i&1))
    return str(min(different,n-different))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
