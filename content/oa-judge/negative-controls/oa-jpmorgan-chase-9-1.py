def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];v=d[2+n:];left=min(v[::2]);right=max(v[1::2])
    return str(sum(left<=f<=right for f in a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
