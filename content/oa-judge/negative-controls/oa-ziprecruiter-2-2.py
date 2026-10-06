def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); m=next(it)
 fish=sorted(next(it) for _ in range(n)); baits=sorted(next(it) for _ in range(m))
 i=ans=0
 for b in baits:
  while i<n and fish[i]<=b: i+=1
  used=0
  while i<n and used<1: ans+=1; i+=1; used+=1
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
