def solve(d):
    from array import array
    n,m=map(int,d[:2]);order=list(map(int,d[3:]))
    if m==0:return '1'
    spans=array('i',[0])*(n+2);bad=n*(n+1)//2
    for t in range(n,0,-1):
        p=order[t-1];left=spans[p-1];right=spans[p+1];length=left+right+1
        spans[p]=1;spans[p-left]=spans[p+right]=length;bad-=(left+1)*(right+1)
        if bad<=m:return str(t)
    return '1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
