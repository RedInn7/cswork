def solve(d):
    n,k=map(int,d[:2]);a=sorted(map(int,d[2:]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def aggregate(t):
        j=n;count=total=0
        for v in a:
            while j and a[j-1]+v>=t:j-=1
            c=n-j;count+=c;total+=c*v+prefix[n]-prefix[j]
        return count,total
    low=2*a[0];high=2*a[-1]+1
    while low+1<high:
        middle=(low+high)//2
        if aggregate(middle)[0]>=k:low=middle
        else:high=middle
    count,total=aggregate(low)
    return str((total-(count-k)*low)//2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
