def solve(d):
    n,weeks=map(int,d[:2]);a=list(map(int,d[2:]));inf=10**30;previous=[0]+[inf]*n
    for w in range(1,weeks+1):
        current=[inf]*(n+1)
        for i in range(w,n+1):
            high=0
            for j in range(i-1,w-2,-1):high=max(high,a[j]);current[i]=min(current[i],previous[j]+high)
        previous=current
    return str(max(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
