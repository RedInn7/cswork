import sys
v=list(map(int,sys.stdin.buffer.read().split()));n=v[0];rs=v[1:n+2];cs=v[n+2:2*n+3];print(sum(c for i,(r,c) in enumerate(zip(rs,cs)) if max(0,i-r)<=0 and min(n,i+r)>0))
