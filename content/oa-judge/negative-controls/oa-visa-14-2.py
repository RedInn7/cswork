import sys
def solve(s):
 t=list(map(int,s.split())); rows,cols=t[:2]; raw=t[2:]; mat=[raw[r*cols:(r+1)*cols] for r in range(4)]; n=cols//4; blocks=[]
 for b in range(n):
  flat=[mat[r][4*b+c] for r in range(4) for c in range(4)]; miss=136-sum(x for x in flat if x!=-1)
  full=[miss if x==-1 else x for x in flat]; blocks.append((miss,b,full))
 blocks.sort(key=lambda x:x[1]); out=[[0]*cols for _ in range(4)]
 for b,(_,_,flat) in enumerate(blocks):
  for z,x in enumerate(flat): r,c=divmod(z,4); out[r][4*b+c]=x
 return '\n'.join(' '.join(map(str,row)) for row in out)
if __name__=='__main__': print(solve(sys.stdin.read()))
