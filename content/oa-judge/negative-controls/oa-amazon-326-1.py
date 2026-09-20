def solve(d):
    from array import array
    from bisect import bisect_left,bisect_right
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));d[2:2+n]=[None]*n;a.sort();prefix=array('Q',[0]);total=0
    for v in a:total+=v;prefix.append(total)
    out=[];at=2+n
    for _ in range(m):
        low=int(d[at]);high=int(d[at+1]);at+=2;l=bisect_left(a,low);r=bisect_left(a,high)
        out.append(str(r-l)+' '+str(prefix[r]-prefix[l]))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
