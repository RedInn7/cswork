import sys
def solve(raw):
 t=list(map(int,raw.split())); n,k,need=t[:3]; a=t[3:3+n]; count=length=total=0
 for v in a:
  length+=1; total+=v
  if total>=need: count+=1; length=total=0
 return str(count)
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
