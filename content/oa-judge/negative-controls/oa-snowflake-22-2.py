def solve(d):
    s=d[0];limit=min(999999,10**min(6,len(s))-1);p=bytearray(b'\x01')*(limit+1);p[0:2]=b'\x00\x00'
    for v in range(2,math.isqrt(limit)+1):
        if p[v]:p[v*v:limit+1:v]=b'\x00'*((limit-v*v)//v+1)
    dp=[0]*(len(s)+1);dp[0]=1
    for i,c in enumerate(s):
        if c=='0':continue
        value=0
        for j in range(i,min(len(s),i+1)):
            value=value*10+int(s[j])
            if p[value]:dp[j+1]=(dp[j+1]+dp[i])%1000000007
    return str(dp[-1])
import math

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
