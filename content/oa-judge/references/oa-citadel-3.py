from itertools import product
def solve(raw):
    s=raw.strip();mod=1000000007;answer=0
    for a,b,c in product('01',repeat=3):
        pattern=a+b+c+b+a;dp=[1,0,0,0,0,0]
        for ch in s:
            for j in range(5,0,-1):
                if ch==pattern[j-1]:dp[j]=(dp[j]+dp[j-1])%mod
        answer=(answer+dp[5])%mod
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
