def solve(d):
    a=list(map(int,d[1:]));n=len(a);buckets=[[] for _ in range(max(a)+1)]
    for i,v in enumerate(a):buckets[v].append(i)
    alive=[True]*n;left=0;count=n;t=0;out=[]
    while count:
        out.append(count)
        while not alive[left]:left+=1
        alive[left]=False;count-=1;t+=1
        if t<len(buckets):
            for i in buckets[t]:
                if alive[i]:alive[i]=False;count-=1
    out.append(0)
    return ' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
