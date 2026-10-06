import sys
def solve(raw):
 t=list(map(int,raw.split()));N,m=t[:2];a=sorted((t[i],t[i+1]) for i in range(2,len(t),2));p=1;ans=0
 for l,r in a+[(N+1,N+1)]:
  if l>p:ans+=1
  p=r+1
 return str(ans)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
