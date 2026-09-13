def solve(d):
    n,m=map(int,d[:2]);previous=[0]*(m+1);best=0
    for row in d[2:]:
        current=[0]*(m+1)
        for j,c in enumerate(row,1):
            if c=='1':current[j]=1+min(previous[j],current[j-1]);best=max(best,current[j])
        previous=current
    return str(best*best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
