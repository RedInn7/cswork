def solve(raw):
 import heapq
 z=raw.splitlines();q=int(z[0]);free={};used={};nxt={};out=[]
 for line in z[1:1+q]:
  p=line.split();t=p[1]
  if t not in free:free[t]=[];used[t]=set();nxt[t]=1
  if p[0]=='allocate':
   if free[t]:x=heapq.heappop(free[t])
   else:x=nxt[t];nxt[t]+=1
   used[t].add(x);out.append(str(x))
  else:
   x=int(p[2]);used[t].remove(x);heapq.heappush(free[t],x)
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
