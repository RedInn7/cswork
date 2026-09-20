def solve(d):
    mod=1000000007;fact=[1]*2001
    for i in range(1,2001):fact[i]=fact[i-1]*i%mod
    inv=[1]*2001;inv[-1]=pow(fact[-1],mod-2,mod)
    for i in range(2000,0,-1):inv[i-1]=inv[i]*i%mod
    def choose(a,b):return fact[a]*inv[b]%mod*inv[a-b]%mod if 0<=b<=a else 0
    def parts(s,n):
        out=[0]*(s+2)
        for k in range((s+n-1)//n,s+1):
            if n==1:out[k]=1
            elif n==2:out[k]=choose(k,s-k)
            else:
                value=0
                for j in range((s-k)//n+1):
                    term=choose(k,j)*choose(s-j*n-1,k-1)%mod
                    value+=term if j%2==0 else -term
                out[k]=value%mod
        return out
    cases=[tuple(map(int,d[i:i+3])) for i in range(1,len(d),3)]
    needs={};cache={};answers=[]
    for p,c,n in cases:
        if p>n*(c+1) or c>n*(p+1) or n>=max(p,c):continue
        needs.setdefault(n,set()).update((p,c))
    for n,totals in needs.items():
        maximum=max(totals)
        # Count both algorithms' work before choosing; shared DP handles many
        # distinct totals with the same run limit without repeated binomial sums.
        inclusion=sum((s-k)//n+1 for s in totals for k in range((s+n-1)//n,s+1))
        cells=sum(min(maximum,n*k)-k+1 for k in range(1,maximum+1))
        if n<=2 or 5*inclusion<cells:
            for s in totals:cache[s,n]=parts(s,n)
            continue
        for s in totals:cache[s,n]=[0]*(s+2)
        previous=[0]*(maximum+1);previous[0]=1
        for k in range(1,maximum+1):
            current=[0]*(maximum+1);window=0;upper=min(maximum,n*k)
            for s in range(k,upper+1):
                window+=previous[s-1]
                if s>n:window-=previous[s-n-1]
                window%=mod;current[s]=window
            for s in totals:
                if k<=s<=upper:cache[s,n][k]=current[s]
            previous=current
    for p,c,n in cases:
        if p>n*(c+1) or c>n*(p+1):answers.append(0);continue
        if n>=max(p,c):answers.append(choose(p+c,p));continue
        a=cache[p,n];b=cache[c,n];answer=0
        for k in range(1,min(p,c)+1):answer=(answer+2*a[k]*b[k])%mod
        answers.append(answer)
    return '\n'.join(map(str,answers))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
