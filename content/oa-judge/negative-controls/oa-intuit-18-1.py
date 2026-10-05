import sys
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];x=0;total=0;used=set()
while x<n:
 opts=[(min(n,i+r),-cs[i],i) for i,r in enumerate(rs) if max(0,i-r)<=x<min(n,i+r) and i not in used]
 if not opts:print(-1);break
 far,neg,i=max(opts);used.add(i);total-=neg;x=far
else:print(total)
