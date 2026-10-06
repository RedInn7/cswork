import sys
def solve(raw):
    z=list(map(int,raw.split())); n=z[0]; s=z[1:1+n]; e=z[1+n:1+2*n]
    q=sorted((s[i],e[i]) for i in range(n)); day=0; ans=0; i=0; h=[]
    import heapq
    while i<n or h:
      if not h: day=max(day,q[i][0])
      while i<n and q[i][0]<=day: heapq.heappush(h,q[i][1]); i+=1
      while h and h[0]<day: heapq.heappop(h)
      if h: ans+=1; heapq.heappop(h); h=[]; day+=1
    return str(ans)

print(solve(sys.stdin.read()))
