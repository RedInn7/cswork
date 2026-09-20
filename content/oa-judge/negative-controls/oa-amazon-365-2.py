def solve(raw):
    a=list(map(int,raw.split()))[1:];n=len(a);target=(n*(n+1)//2+1)//2;lo=1;hi=n
    while lo<hi:
        mid=(lo+hi)//2;counts=[0]*(n+1);left=distinct=total=0
        for right,v in enumerate(a):
            if not counts[v]:distinct+=1
            counts[v]+=1
            while distinct>mid:
                u=a[left];counts[u]-=1;left+=1
                if not counts[u]:distinct-=1
            total+=int(right>=left)
        if total>=target:hi=mid
        else:lo=mid+1
    return str(lo)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
