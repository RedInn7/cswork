def solve(raw):
 import heapq
 a=list(map(int,raw.split())); n=a[0]; h=[-x for x in a[1:1+n]]; heapq.heapify(h)
 while len(h)>1:
  x=-heapq.heappop(h); y=-heapq.heappop(h)
  if x!=y: heapq.heappush(h,-(x-y))
 return str(-h[0] if h else 0)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
