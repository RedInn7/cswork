def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; a=v[1:1+n]; out=[]
 for i in range((n+1)//2):
  out.append(a[i])
  if i < n-1-i: out.append(a[n-1-i])
 return ' '.join(map(str,out))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
