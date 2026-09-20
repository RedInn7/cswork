def solve(d):
    from bisect import bisect_right
    n,budget=map(int,d[:2]);a=sorted(map(int,d[2:]));prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def cost(p):
        count=bisect_right(a,p);return 2*(p*count-prefix[count]+prefix[n]-prefix[count]-p*(n-count))
    middle=a[n//2]
    if cost(middle)>budget:return '0'
    l=-10**9;r=middle
    while l<r:
        mid=(l+r)//2
        if cost(mid)<=budget:r=mid
        else:l=mid+1
    first=l;l=middle;r=10**9
    while l<r:
        mid=(l+r+1)//2
        if cost(mid)<=budget:l=mid
        else:r=mid-1
    return str(l-first+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
