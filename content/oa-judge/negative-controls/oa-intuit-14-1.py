from array import array
from collections import deque
import math
import sys

def solve(raw):
    m,n,x,p,q,u,v=map(int,raw.split())
    if not (1<=m<=1000 and 1<=n<=1000 and 1<=x<=1000 and 1<=p<=m and 1<=u<=m and 1<=q<=n and 1<=v<=n):
        raise ValueError("outside source constraints")
    sr,sc,tr,tc=p-1,q-1,u-1,v-1
    if (sr,sc)==(tr,tc): return "0"
    moves=set()
    for dr in range(x+1):
        rem=x*x-dr*dr; dc=math.isqrt(rem)
        if dc*dc<=rem:
            for a in {dr,-dr}:
                for b in {dc,-dc}: moves.add((a,b))
    moves.discard((0,0))
    if not moves: return "-1"
    dist=array('i',[-1])*(m*n); start=sr*n+sc; target=tr*n+tc
    dist[start]=0; queue=array('i',[start]); head=0
    while head<len(queue):
        cur=queue[head]; head+=1; r,c=divmod(cur,n); nd=dist[cur]+1
        for dr,dc in moves:
            nr,nc=r+dr,c+dc
            if 0<=nr<m and 0<=nc<n:
                nxt=nr*n+nc
                if dist[nxt]<0:
                    if nxt==target: return str(nd)
                    dist[nxt]=nd; queue.append(nxt)
    return "-1"

if __name__=="__main__": print(solve(sys.stdin.read()))

