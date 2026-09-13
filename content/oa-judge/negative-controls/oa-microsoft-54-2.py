def solve(d):
    n=int(d[0]);a=list(map(int,d[1:n+1]));b=list(map(int,d[n+1:]));suffix=[0]*n;suffix[-1]=b[-1]
    for i in range(n-2,-1,-1):suffix[i]=max(b[i],suffix[i+1])
    prefix=0;answer=10**30
    for i in range(n):prefix=max(prefix,a[i]);answer=min(answer,max(prefix,suffix[i]))
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
