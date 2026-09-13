def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));ids=sorted(range(n),key=lambda i:(-a[i],i))[:k]
    return ' '.join(str(a[i]) for i in sorted(ids))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
