import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];s=length=0
 for x in a:
  if s+x>k:break
  s+=x;length+=1
 return str(length)
if __name__=='__main__':print(solve(sys.stdin.read()))
