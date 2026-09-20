def solve(d):
    m,n=map(int,d[:2]);initial=map(int,d[2:2+m]);target=list(map(int,d[2+m:]));position={v:i for i,v in enumerate(target)};before=[];last=-1
    for i,v in enumerate(target):
        before.append(last)
        if False:last=i
    size=1
    while size<n:size*=2
    tree=[-10**9]*(2*size)
    def query(l,r):
        l+=size;r+=size;answer=-10**9
        while l<r:
            if l&1:answer=max(answer,tree[l]);l+=1
            if r&1:r-=1;answer=max(answer,tree[r])
            l//=2;r//=2
        return answer
    for v in initial:
        if v not in position:continue
        q=position[v];b=before[q];best=query(max(0,b),q)
        if b<0:best=max(best,0)
        if best<0:continue
        at=q+size;value=best+1
        if tree[at]>=value:continue
        tree[at]=value;at//=2
        while at:tree[at]=max(tree[2*at],tree[2*at+1]);at//=2
    matched=query(max(0,last),n)
    if last<0:matched=max(matched,0)
    return str(n-matched) if matched>=0 else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
