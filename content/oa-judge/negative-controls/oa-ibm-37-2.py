def solve(d):
    a=list(map(int,d[1:]));n=len(a);chosen=[False]*n;x=0
    for i in range(2,n):
        if a[i]<a[i-1]:chosen[i]=True;x=max(x,a[i-1]-a[i])
    if any(chosen[i] and chosen[i-1] for i in range(1,n)):return '-1'
    b=[v+x if chosen[i] else v for i,v in enumerate(a)]
    return str(x) if all(b[i]>=b[i-1] for i in range(1,n)) else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
