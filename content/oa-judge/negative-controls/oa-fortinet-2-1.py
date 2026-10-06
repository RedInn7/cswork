# 只累加 i mod j，遗漏 j mod i
def solve(raw):
 n=int(raw.split()[0]);m=1000000007;s=0
 for j in range(1,n+1):
  q,r=divmod(n,j);s=(s+q*j*(j-1)//2+r*(r+1)//2)%m
 return str(s)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
