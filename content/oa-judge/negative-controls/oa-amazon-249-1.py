def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]));values=sorted(set(a));index={v:i+1 for i,v in enumerate(values)};size=len(values);tree=[0]*(size+1)
    def add(value,delta):
        i=index[value]
        while i<=size:tree[i]+=delta;i+=i&-i
    for v in a[:m]:add(v,1)
    out=[]
    for start in range(n-m+1):
        if start:add(a[start-1],-1);add(a[start+m-1],1)
        target=max(1,k-1);at=0;step=1<<(size.bit_length()-1)
        while step:
            nxt=at+step
            if nxt<=size and tree[nxt]<target:target-=tree[nxt];at=nxt
            step//=2
        out.append(str(values[at]))
    return ' '.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
