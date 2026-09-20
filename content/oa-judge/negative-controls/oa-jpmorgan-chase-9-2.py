def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];v=d[2+n:];left=max(v[::2]);right=min(v[1::2])
    return str(sum(left<f<right for f in a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
