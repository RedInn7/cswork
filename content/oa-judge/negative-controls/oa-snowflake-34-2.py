def solve(d):
    s,t=d[:2];order=list(map(int,d[2:]));when=[0]*len(s)
    for step,pos in enumerate(order,1):when[pos-1]=step
    def works(count):
        j=0
        for i,c in enumerate(s):
            if when[i]>count and c.lower()==t[j].lower():
                j+=1
                if j==len(t):return True
        return False
    lo=0;hi=len(s)
    while lo<hi:
        mid=(lo+hi+1)//2
        if works(mid):lo=mid
        else:hi=mid-1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
