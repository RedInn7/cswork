import sys
def solve(raw):
 ds=[]
 for x in raw.strip().split(";"):
  if x.strip(): ds.append(int(x.rsplit(",",1)[1].strip()))
 ds.sort()
 return ", ".join(str(ds[i]-ds[i-1]) for i in range(1,len(ds)))
if __name__=="__main__": print(solve(sys.stdin.read()))
