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
    cache={};answers=[]
    for i in range(1,len(d),3):
        p,c,n=map(int,d[i:i+3])
        if p>n*(c+1) or c>n*(p+1):answers.append(0);continue
        if n>=max(p,c):answers.append(choose(p+c,p));continue
        for s in (p,c):
            if (s,n) not in cache:cache[(s,n)]=parts(s,n)
        a=cache[p,n];b=cache[c,n];answer=0
        for k in range(1,min(p,c)+1):answer=(answer+a[k]*b[k]+a[k+1]*b[k]+a[k]*b[k+1])%mod
        answers.append(answer)
    return '\n'.join(map(str,answers))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
