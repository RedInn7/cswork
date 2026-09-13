def solve(d):
    s=d[0]
    if all(s[i-1]<=s[i] for i in range(1,len(s))):return '0'
    lo=min(s);hi=max(s)
    if s[0]==lo or s[-1]==hi:return '1'
    if s[0]==hi and s[-1]==lo and s.count(lo)==1 and s.count(hi)==1:return '3'
    return '3'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
