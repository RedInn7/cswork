import math
def solve(d):
    from collections import Counter
    from functools import lru_cache
    MOD=1000000007;n,q=map(int,d[:2]);a=list(map(int,d[2:2+n]));raw=list(map(int,d[2+n:]));limit=max(a+raw[1::2]);spf=list(range(limit+1))
    for p in range(2,math.isqrt(limit)+1):
        if spf[p]==p:
            for v in range(p*p,limit+1,p):
                if spf[v]==v:spf[v]=p
    radical=[1]*(limit+1)
    for value in range(2,limit+1):
        p=spf[value];quotient=value//p;radical[value]=radical[quotient]*(1 if quotient%p==0 else p)
    @lru_cache(maxsize=1024)
    def factors(value):
        primes=[]
        while value>1:
            p=spf[value];primes.append(p)
            while value%p==0:value//=p
        terms=[(1,1)]
        for p in primes:terms.extend([(v*p,-sign) for v,sign in terms])
        return tuple(terms[1:])
    powers=[1]*(n+1)
    for i in range(n):powers[i+1]=powers[i]*2%MOD
    counts=[0]*(limit+1)
    for value,frequency in Counter(a).items():
        for divisor,sign in factors(radical[value]):counts[divisor]+=frequency
    current=0
    for divisor in range(2,limit+1):
        if counts[divisor]:
            terms=factors(divisor)
            if terms and terms[-1][0]==divisor:current-=terms[-1][1]*(powers[counts[divisor]]-1)
    current%=MOD;answer=0
    for i in range(0,len(raw),2):
        index,value=raw[i]-1,raw[i+1];old=a[index]
        if radical[old]!=radical[value]:
            for number,delta in ((old,-1),(value,1)):
                for divisor,sign in factors(radical[number]):
                    current+=sign*(powers[counts[divisor]]-1);counts[divisor]+=delta;current-=sign*(powers[counts[divisor]]-1)
            current%=MOD
        a[index]=value
        answer+=current
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
