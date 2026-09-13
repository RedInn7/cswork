def solve(d):
    s=d[0];left=(len(s)-1)//2;right=len(s)//2;center=s[left]
    while left>0 and s[left-1]==center:left-=1
    while right+1<len(s) and s[right+1]==center:right+=1
    return str(1 if len(s)%2 else 2)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
