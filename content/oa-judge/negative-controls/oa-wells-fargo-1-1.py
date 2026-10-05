import sys
def solve(raw):
 t=list(map(int,raw.split()));n=t[0];p=t[1:1+n];s=[False]*n;best=1
 for i in range(n):
  if not s[i]:
   j=i;z=0
   while not s[j]:s[j]=True;j=p[j]-1;z+=1
   best=max(best,z)
 return str(best)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
