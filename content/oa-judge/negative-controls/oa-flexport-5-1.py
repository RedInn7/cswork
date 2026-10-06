def solve(raw):
    v=list(map(int,raw.split()));n,m=v[:2];p=v[2:2+n];x=v[2+n:2+n+m]
    return str(max(min(abs(z-q) for q in p) for z in x))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
