def solve(raw):
 z=raw.split(); q=int(z[0]); out=[]
 for s in z[1:1+q]:
  x=y=d=0; dx=[0,1,0,-1]; dy=[1,0,-1,0]
  for c in s:
   if c=='L':d=(d+1)%4
   elif c=='R':d=(d-1)%4
   else:x+=dx[d];y+=dy[d]
  out.append('YES' if (x,y)==(0,0) and d==0 else 'NO')
 return '\n'.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
