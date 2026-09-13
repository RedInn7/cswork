def solve(d):
    n,m,k=map(int,d[:3]);a=list(map(int,d[3:]));values=sorted(set(a));rank={v:i+1 for i,v in enumerate(values)};size=len(values);tree=[0]*(size+1)
    def update(index,delta):
        while index<=size:tree[index]+=delta;index+=index&-index
    def kth():
        index=0;target=k;step=1<<(size.bit_length()-1)
        while step:
            following=index+step
            if following<=size and tree[following]<target:index=following;target-=tree[following]
            step>>=1
        return values[index]
    for i in range(m):update(rank[a[i]],1)
    answer=[kth()]
    for i in range(m,n):update(rank[a[i-m]],-1);update(rank[a[i]],1);answer.append(kth())
    return ' '.join(map(str,answer))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
