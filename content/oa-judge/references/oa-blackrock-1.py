import sys
def solve(raw):
 ds=[]
 for x in raw.strip().split(";"):
  if x.strip(): ds.append(int(x.rsplit(",",1)[1].strip()))
 ds.sort()
 return ", ".join(str(ds[0] if i==0 else ds[i]-ds[i-1]) for i in range(len(ds)))
if __name__=="__main__": print(solve(sys.stdin.read()))
