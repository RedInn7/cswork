def solve(raw):
    s=raw.strip();mod=1000000007;dp=[int(s[0]=='?' or ord(s[0])-97==c) for c in range(25)]
    for ch in s[1:]:
        total=sum(dp)%mod
        dp=[(total-dp[c])%mod if ch=='?' or ord(ch)-97==c else 0 for c in range(25)]
    return str(sum(dp)%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
