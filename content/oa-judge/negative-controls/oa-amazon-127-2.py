def solve(d):
    s=d[0];n=len(s);answer=0
    for center in range(2*n-1):
        left=center//2;right=(center+1)//2
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer-n)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
