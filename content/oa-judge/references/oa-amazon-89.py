def solve(d):
    from array import array
    h,w=map(int,d[:2]);g=''.join(d[2:]);distance=array('i',[-1])*(h*w);distance[0]=0;q=array('i',[0]);head=0
    while head<len(q):
        cell=q[head];head+=1
        if g[cell]=='9':return str(distance[cell])
        r,c=divmod(cell,w)
        for nxt in (cell-w if r else -1,cell+w if r+1<h else -1,cell-1 if c else -1,cell+1 if c+1<w else -1):
            if nxt>=0 and g[nxt]!='0' and distance[nxt]<0:distance[nxt]=distance[cell]+1;q.append(nxt)
    return '-1'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
