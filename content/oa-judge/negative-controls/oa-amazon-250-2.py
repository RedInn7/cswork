def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));best=[0]*n;at=n-1
    for i in range(n-1,-1,-1):
        if a[i]>=a[at]:at=i
        best[i]=at
    out=[];i=0
    while i<n:
        j=max(range(i,min(n,i+k+1)),key=lambda t:a[t]);out.append(str(a[j]));i=j+k+1
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
