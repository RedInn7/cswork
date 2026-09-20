def solve(d):
    a,b,ma,mb=map(int,d)
    if ma==0:return str(min(b,mb))
    if mb==0:return str(min(a,ma))
    if a>ma*(b+1):return str(b+ma*(b+1))
    if b>mb*(a+1):return str(a+mb*(a+1))
    return str(a+b)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
