def solve(raw):
    MOD=1000000007; s=raw.strip(); n=len(s); cnt=[0]*26
    for c in s: cnt[ord(c)-97]+=1
    fact=[1]*(n+1)
    for i in range(1,n+1): fact[i]=fact[i-1]*i%MOD
    inv=[1]*(n+1); inv[n]=pow(fact[n],MOD-2,MOD)
    for i in range(n-1,-1,-1): inv[i]=inv[i+1]*(i+1)%MOD
    ans=0
    for k in range(1,max(cnt)+1):
        prod=1
        for c in cnt:
            if c>=k: prod=prod*(fact[c]*inv[k]%MOD*inv[c-k]+1)%MOD
        ans=(ans+prod)%MOD
    return str(ans)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
