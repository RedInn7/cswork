def solve(d):
    a=list(map(int,d[1:]));n=len(a);average=sum(a)//n;prefix=total=low=high=0
    for v in a:prefix+=v-average;total+=prefix;low=min(low,prefix);high=max(high,prefix)
    p=[];s=0
    for v in a:s+=v-average;p.append(s)
    p.sort();middle=p[n//2]
    return str(sum(abs(v-middle) for v in p))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
