import heapq
import sys
def solve(raw):
 z=list(map(int,raw.split())); n,k=z[:2]; pins=z[2:2+n]
 heap=[(0,i) for i in range(k)]; heapq.heapify(heap); heights=[0]*k; assigned=[]
 for pin in pins:
  h,i=heapq.heappop(heap); assigned.append(i); heights[i]=h+pin; heapq.heappush(heap,(heights[i],i))
 return ' '.join(map(str,assigned))+chr(10)+' '.join(map(str,heights))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
