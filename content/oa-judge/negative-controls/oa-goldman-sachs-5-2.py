def solve(raw):
    s=raw.strip();n=len(s);answer=0
    for center in range(n):
        left=right=center
        while left>=0 and right<n and s[left]==s[right]:answer+=1;left-=1;right+=1
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
