def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));answer=-10**30
    for divide in (False,True):
        before=inside=after=-10**30
        for v in a:
            changed=(abs(v)//k)*(1 if v>=0 else -1) if divide else v*k
            after=max(inside+v,after+v);inside=max(changed,before+changed,inside+changed);before=max(v,before+v)
            answer=max(answer,inside,after)
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
