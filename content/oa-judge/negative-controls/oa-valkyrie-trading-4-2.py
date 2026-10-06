# 检查相邻奇偶位
import sys
def solve(raw):
 n=int(raw.strip())
 return '1' if n>0 and (n&(n+1))==0 else '0'

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
