import sys
def solve(raw):
    a,b=map(int,raw.split())
    def upto(x):
      if x<0:return 0
      ds=list(map(int,str(x))); L=len(ds); ans=1
      def perm(n,k):
        if k>n:return 0
        v=1
        for t in range(k):v*=n-t
        return v
      for length in range(1,min(L,10)): ans+=9*perm(9,length-1)
      used=set()
      for i,d in enumerate(ds):
        low=1 if i==0 else 0
        remaining=L-i-1
        for c in range(low,d):
          if c not in used: ans+=perm(9-len(used),remaining)
        if d in used or (i==0 and d==0): break
        used.add(d)
      else: ans+=1
      return ans
    return str(upto(b)-upto(a-1))

print(solve(sys.stdin.read()))
