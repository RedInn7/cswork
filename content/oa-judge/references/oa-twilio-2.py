def solve(raw):
 v=list(map(int,raw.split()));n=v[0];a=sorted(v[1:n+1]);i=0
 for z in a:
  if i<n and z>a[i]:i+=1
 return str(i)

if __name__ == "__main__":
 import sys
 print(solve(sys.stdin.read()))
