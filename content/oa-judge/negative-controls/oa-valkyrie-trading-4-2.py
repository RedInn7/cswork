# 检查相邻奇偶位
def solve(raw):
 n=int(raw.strip())
 return '1' if n>0 and (n&(n+1))==0 else '0'
