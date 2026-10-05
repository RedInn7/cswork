def solve(s):
 it=iter(map(int,s.split()));n=next(it);l=next(it);h=next(it);a=[next(it) for _ in range(n)];z=0
 for i in range(n):
  mn=10**9;mx=0
  for j in range(i,n):mn=min(mn,a[j]);mx=max(mx,a[j]);z+=mn>=l and mx<=h
 print(z)
import sys;solve(sys.stdin.read())