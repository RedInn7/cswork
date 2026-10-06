def solve(raw):
 import heapq
 a=list(map(int,raw.split())); h=[-x for x in a[1:1+a[0]]]; heapq.heapify(h)
 while len(h)>1:
  x=-heapq.heappop(h); y=-heapq.heappop(h)
  heapq.heappush(h,-(x-y if x!=y else x))
 return str(-h[0] if h else 0)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
