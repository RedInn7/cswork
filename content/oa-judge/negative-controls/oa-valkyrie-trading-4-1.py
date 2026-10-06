# 将零误判为 2 的幂
import sys
def solve(raw):
 n=int(raw.strip())
 return '1' if (n&(n-1))==0 else '0'

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
