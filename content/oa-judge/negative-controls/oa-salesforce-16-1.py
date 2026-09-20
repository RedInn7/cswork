def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:2+n]));sizes=list(map(int,d[2+n:]));q=k
    return str(sum(a[n-q:])-sum(a[:q]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
