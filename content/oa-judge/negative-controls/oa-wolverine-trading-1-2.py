def solve(raw):
 a=list(map(int,raw.split())); n=a[0]; p=[x-1 for x in a[1:1+n]]; seen=[0]*n; i=0; j=i; z=0
 while not seen[j]: seen[j]=1; z+=1; j=p[j]
 return str(z)
if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
