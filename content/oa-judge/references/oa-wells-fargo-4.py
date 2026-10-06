import sys
def solve(raw):
 t=list(map(int,raw.split()));n,k=t[:2];a=t[2:2+n];groups=1;product=a[0]
 for x in a[1:]:
  if product*x<=k:product*=x
  else:groups+=1;product=x
 return str(groups)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
