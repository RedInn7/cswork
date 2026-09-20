def solve(d):
    s=d[0];best=len(s)-1;left=right=-1
    for i in range(len(s)-2,-1,-1):
        if s[i]>s[best]:left=i;right=best
        elif s[i]<=s[best]:best=i
    if left<0:return s
    return s[:left]+s[right]+s[left:right]+s[right+1:]

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
