def solve(raw):
 z=list(map(int,raw.split()));p=0;D=z[p];p+=1;U=z[p];p+=1;diff=[0]*(D+2)
 for _ in range(U):
  l,r,v=z[p:p+3];p+=3
  if v:diff[l]+=1;diff[r+1]-=1
 O=z[p];p+=1;over=[None]*(D+1)
 for _ in range(O):
  l,r,v=z[p:p+3];p+=3
  for i in range(l,r+1):over[i]=v
 cur=0;out=[]
 for i in range(1,D+1):
  cur+=diff[i];out.append(str(int(cur>0) if over[i] is None else over[i]))
 return ''.join(out)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
