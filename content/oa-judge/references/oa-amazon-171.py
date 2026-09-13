def solve(d):
    n,k,p=map(int,d[:3]);a=list(map(int,d[3:]));ends=[0]*(n+1);active=answer=0
    for i,v in enumerate(a):
        active-=ends[i];need=(v+p-1)//p
        if need>active:
            delta=need-active;answer+=delta;active+=delta;start=min(i,n-k);ends[start+k]+=delta
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
