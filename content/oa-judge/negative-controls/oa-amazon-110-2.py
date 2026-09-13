def solve(d):
    a=sorted(map(int,d[1:]));n=len(a);prefix=[0]
    for v in a:prefix.append(prefix[-1]+v)
    def cost(l,r):
        if l==r:return 0
        m=(l+r)//2
        return a[m]*(m-l)-(prefix[m]-prefix[l])+(prefix[r]-prefix[m+1])-a[m]*(r-m-1)
    return str(min(cost(0,i)+cost(i,n) for i in [n//2]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
