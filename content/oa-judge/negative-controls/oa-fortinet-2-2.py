# 错误地跳过至少一项模运算为零的 distinct pair
def solve(raw):
 n=int(raw.split()[0]);s=0
 for i in range(1,n+1):
  for j in range(1,n+1):
   if i!=j and i%j and j%i:s+=i%j+j%i
 return str(s%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
