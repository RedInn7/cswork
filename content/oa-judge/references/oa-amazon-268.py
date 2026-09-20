def solve(d):
    n,limit=map(int,d[:2]);primary=list(map(int,d[2:2+n]));secondary=sorted(map(int,d[2+n:]));remain=sorted(limit-v for v in primary);j=0
    for capacity in remain:
        if j<n and secondary[j]<=capacity:j+=1
    return str(j)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
