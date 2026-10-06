from collections import deque
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); q=deque(); out=[]
 for t in (next(it) for _ in range(n)):
  while q and q[0]<=t: q.popleft()
  wait=max(0,len(q)-1)
  if wait>=10: out.append(t)
  elif not q: q.append(t+300); out.append(t+300)
  else: q.append(q[-1]+300); out.append(q[-1])
 return " ".join(map(str,out))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
