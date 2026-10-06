def solve(raw):
 z=raw.splitlines();m,n=map(int,z[0].split());s=0;o=[]
 for line in z[1:1+m]:
  a=list(map(int,line.split()));r=[]
  for x in a[:n]:s+=x;r.append(str(s))
  o.append(' '.join(r))
 return '\n'.join(o)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
