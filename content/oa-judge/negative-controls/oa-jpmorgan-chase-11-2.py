def solve(raw):
    a=list(map(int,raw.split()))[1:]
    return str(abs(a[-1])+sum(abs(x-y) for x,y in zip(a,a[1:])))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
