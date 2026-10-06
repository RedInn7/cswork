import sys
V=set('aeiou')
def solve(raw):
 s=raw.strip(); n=len(s); v=sum(ch in V for ch in s); target=n//2
 if n%2: return '-1'
 need=abs(v-target)
 source=[ch for ch in s if (ch in V)==(v>target)]
 other=V if v<target else set('bcdfghjklmnpqrstvwxyz')
 return str(need)
if __name__=='__main__': print(solve(sys.stdin.read()))
