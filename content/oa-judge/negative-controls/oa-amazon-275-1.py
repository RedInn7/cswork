def solve(d):
    from bisect import bisect_left
    n,k=map(int,d[:2]);a=list(map(int,d[2:2+n]));order=list(map(int,d[2+n:]));removed_at=[0]*n
    for time,index in enumerate(order,1):removed_at[index]=time
    def feasible(t):
        tails=[]
        for i,v in enumerate(a):
            if removed_at[i]<=t:continue
            pos=bisect_left(tails,v)
            if pos==len(tails):tails.append(v)
            else:tails[pos]=v
        return len(tails)>=k
    if not feasible(0):return '0'
    low=0;high=n+1
    while low+1<high:
        middle=(low+high)//2
        if feasible(middle):low=middle
        else:high=middle
    return str(low)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
