def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:2+n]));b=list(map(int,d[2+n:]));gain=sorted((x-y for x,y in zip(a,b)),reverse=True)
    return str(sum(b)+sum(max(0,g) for g in gain[:k]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
