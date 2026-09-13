def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gain=sorted((x-y for x,y in zip(a,b)),reverse=False)
    return str(sum(b)+sum(gain[:k]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
