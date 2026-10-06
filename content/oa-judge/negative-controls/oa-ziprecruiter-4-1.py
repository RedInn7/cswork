from collections import Counter
def solve(raw):
 it=iter(map(int,raw.split())); n=next(it); f=Counter(); ans=0
 for x in (next(it) for _ in range(n)): ans+=f[x]; f[x]+=1
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
