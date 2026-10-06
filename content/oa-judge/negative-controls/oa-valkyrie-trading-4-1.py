# 将零误判为 2 的幂
def solve(raw):
 n=int(raw.strip())
 return '1' if (n&(n-1))==0 else '0'
