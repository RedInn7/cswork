def solve(raw):
 v=list(map(int,raw.split()));n,t=v[:2];a=v[2:n+2];i=0;c=1
 while a[i]-a[0]<t:
  if i+2<n:i+=2
  elif i+1<n:i+=1
  else:return str(n)
  c+=1
 return str(c)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
