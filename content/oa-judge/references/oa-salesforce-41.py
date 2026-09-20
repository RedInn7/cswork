def solve(raw):
    n,k=map(int,raw.split());mod=1000000007
    if k==1:return '0'
    counts=[1]*(n+1)
    for i in range(1,n+1):
        counts[i]=26*counts[i-1]%mod
        if i==k:counts[i]=(counts[i]-26)%mod
        elif i>k:counts[i]=(counts[i]-25*counts[i-k])%mod
    return str(counts[n])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
