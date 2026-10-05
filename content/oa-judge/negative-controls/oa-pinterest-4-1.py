import heapq
import sys
def solve(raw):
 z=list(map(int,raw.split())); n,k=z[:2]; h=[0]*k; q=[(0,-i) for i in range(k)]; heapq.heapify(q); a=[]
 for x in z[2:2+n]:
  v,ni=heapq.heappop(q); i=-ni; a.append(i); h[i]=v+x; heapq.heappush(q,(h[i],ni))
 return ' '.join(map(str,a))+chr(10)+' '.join(map(str,h))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
