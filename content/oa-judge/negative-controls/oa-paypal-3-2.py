import sys,heapq
def solve(raw):
 t=list(map(int,raw.split())); n,m=t[:2]; h=[-x for x in t[2:2+n]]; heapq.heapify(h)
 while m and h and h[0]<0:
  x=-heapq.heappop(h); heapq.heappush(h,-((x+1)//2)); m-=1
 return str(-sum(h))
if __name__=='__main__': print(solve(sys.stdin.read()))
