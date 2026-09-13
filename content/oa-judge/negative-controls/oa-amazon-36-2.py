def solve(d):
    n=int(d[0]); a=sorted(map(int,d[1:1+n])); b=sorted(map(int,d[1+n:]),reverse=True)
    return str(sum(abs(x-y) for x,y in zip(a,b)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
