import heapq
def solve(raw):
 v=raw.split();p=0;n=int(v[p]);p+=1;ms=v[p:p+n];p+=n;m=int(v[p]);p+=1;g={x:[] for x in ms};d={x:0 for x in ms}
 for _ in range(m):
  a,b=v[p:p+2];p+=2;g[a].append(b);d[b]+=1
 h=[x for x in ms if d[x]==0];heapq.heapify(h);out=[]
 while h:
  x=heapq.heappop(h);out.append(x)
  for y in g[x]:
   d[y]-=1
   if d[y]==0:heapq.heappush(h,y)
 return ' '.join(out) if len(out)==n else 'IMPOSSIBLE'

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
