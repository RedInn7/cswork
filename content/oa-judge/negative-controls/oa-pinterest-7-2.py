import sys
def solve(raw):
 z=list(map(int,raw.split())); f,n=z[:2]; a=sorted(z[2:2+n]); p=t=0; i=0
 while p<f:
  while i<n and a[i]<p: i+=1
  if i==n: break
  x=a[i]; i+=1; t+=x-p; v=min(f,x+10); t+=v-x; p=v
 return str(t)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
