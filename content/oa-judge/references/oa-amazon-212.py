def solve(d):
    n,k=map(int,d[:2]);a=list(map(int,d[2:]));count=best=0;states={}
    for v in a:
        if v==k:count+=1
        else:
            old,previous=states.get(v,(0,count));gain=max(1,old-(count-previous)+1);states[v]=(gain,count);best=max(best,gain)
    return str(count+best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
