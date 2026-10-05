import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];a=sorted(t[1:1+n],reverse=True);total=count=0
 for value in a:
  if total+value<0:break
  total+=value;count+=1
 return str(count)
if __name__=='__main__':print(solve(sys.stdin.read()))
