def solve(raw):
 n=int(raw.strip()); ds=[]
 while n: ds.append(n%4); n//=4
 ds=ds[::-1]; length=len(ds); ans=sum(2**(k-1) for k in range(1,length))
 if not ds: return "0"
 if ds[0]>1: return str(ans+2**(length-1))
 if ds[0]<1: return str(ans)
 for i in range(1,length):
  smaller=sum(x<ds[i] for x in (0,1))
  ans+=smaller*2**(length-i-1)
  if ds[i] not in (0,1): return str(ans)
 return str(ans)

if __name__ == '__main__':
 import sys
 print(solve(sys.stdin.read()))
