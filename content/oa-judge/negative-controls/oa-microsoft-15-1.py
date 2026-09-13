def solve(d):
    a=list(map(int,d[1:]));v=max(a);freq=[0]*(v+2)
    for x in a:freq[x]+=1
    prefix=[0]*(v+2)
    for x in range(1,v+1):prefix[x]=prefix[x-1]+freq[x]
    following=[v+1]*(v+2);last=v+1
    for x in range(v,0,-1):
        following[x]=last
        if freq[x]<=1:last=x
    best=0;lo=hi=1
    for left in range(1,v+1):
        if not freq[left]:continue
        stop=following[left];right=stop if stop<=v and freq[stop]==1 else stop-1;count=prefix[right]-prefix[left-1]
        if count>best:best=count;lo=left;hi=right
    result=list(range(lo,hi+1))
    for x in range(hi,lo-1,-1):result.extend([x]*(freq[x]-1))
    return '1\n'+str(a[0])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
