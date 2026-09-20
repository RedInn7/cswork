def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];counts={};total=0;best=None
    for i,v in enumerate(a):
        total+=v;counts[v]=counts.get(v,0)+1
        if i>=k:
            old=a[i-k];total-=old;counts[old]-=1
            if counts[old]==0:del counts[old]
        if i+1>=k :best=total if best is None else max(best,total)
    return str(-1 if best is None else best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
