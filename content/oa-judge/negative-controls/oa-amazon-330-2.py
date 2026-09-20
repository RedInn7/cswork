def solve(d):
    from bisect import bisect_left
    n,target=map(int,d[:2]);power=list(map(int,d[2:2+n]));cost=list(map(int,d[2+n:]));groups=[[],[],[]]
    if target<=0:return '0'
    for p,c in zip(power,cost):
        if p>0:groups[c].append(p)
    one=sorted(groups[1],reverse=False);two=sorted(groups[2],reverse=False);prefix=[0]
    for p in two:prefix.append(prefix[-1]+p)
    supplied=0;best=10**30
    for i in range(len(one)+1):
        j=bisect_left(prefix,max(0,target-supplied))
        if j<len(prefix):best=min(best,i+2*j)
        if i<len(one):supplied+=one[i]
    return str(best) if best<10**30 else '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
