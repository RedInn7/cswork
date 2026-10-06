def solve(raw):
 v=list(map(int,raw.split())); n=v[0]; a=v[1:]; o=[]
 for i in range((n+1)//2):
  o.append(a[n-1-i])
  if i<n-1-i:o.append(a[i])
 return ' '.join(map(str,o))

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
