import sys
def solve(raw):
    z=list(map(int,raw.split())); n,m=z[:2]; g=[set() for _ in range(n)]
    for i in range(m):
      a,b=z[2+2*i:4+2*i]; g[a].add(b);g[b].add(a)
    ans=[]
    for y in range(n):
      counts={}
      for f in g[y]:
        for x in g[f]:
          if x!=y and x not in g[y]: counts[x]=counts.get(x,0)+1
      if counts:
        mx=max(counts.values()); ans.append(min(x for x,v in counts.items() if v==mx))
      else:
        ans.append(-1)
    return ' '.join(map(str,ans))

print(solve(sys.stdin.read()))
