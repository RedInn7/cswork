def solve(d):
    n,X,Y,El,Er=map(int,d[:5]);a=list(map(int,d[5:]));total=sum(a);prefix=0;answer=None
    for left in range(n+1):
        right=n-left;cost=prefix*X+(total-prefix)*Y+max(0,left-right-1)*El+max(0,right-left-1)*Er
        answer=cost if answer is None else min(answer,cost)
        if left<n:prefix+=a[left]
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
