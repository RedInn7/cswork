def solve(raw):
    values=list(map(int,raw.split()));n,k=values[:2];a=values[2:]
    if n==0:return '0' if k==0 else '-1'
    if k<1 or k>n:return '0'
    infinity=10**30;previous=[infinity]*(n+1);previous[0]=0
    for groups in range(1,k+1):
        current=[infinity]*(n+1)
        for end in range(groups,n+1):
            largest=0;best=infinity
            for start in range(end-1,groups-2,-1):
                largest=max(largest,a[start]);best=min(best,previous[start]+largest)
            current[end]=best
        previous=current
    return str(previous[n])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
