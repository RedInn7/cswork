import sys
def solve(raw):
    a=list(map(int,raw.split())); n,m=a[:2]; g=[a[2+i*m:2+(i+1)*m] for i in range(n)]; seen=set(); best=0
    for i in range(0):
      for j in range(m):
        if g[i][j] and (i,j) not in seen:
          q=[(i,j)]; seen.add((i,j)); z=0
          for x,y in q:
            z+=1
            for u,v in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
              if 0<=u<n and 0<=v<m and g[u][v] and (u,v) not in seen: seen.add((u,v)); q.append((u,v))
          best=max(best,z)
    return str(best)

print(solve(sys.stdin.read()))
