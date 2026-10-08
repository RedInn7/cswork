import sys

def catalan_residue(n,p,a):
    q=p**a
    prefix=[1]
    for i in range(1,q+1):
        prefix.append(prefix[-1]*(i if i%p else 1)%q)
    def unit_factorial(k):
        result=1
        while k:
            result=result*pow(prefix[q],k//q,q)*prefix[k%q]%q
            k//=p
        return result
    def valuation(k):
        result=0
        while k:
            k//=p
            result+=k
        return result
    divisor=n+1
    removed=0
    while divisor%p==0:
        divisor//=p
        removed+=1
    exponent=valuation(2*n)-2*valuation(n)-removed
    if exponent>=a:
        return 0
    denominator=unit_factorial(n)**2*divisor%q
    return unit_factorial(2*n)*pow(denominator,-1,q)*pow(p,exponent,q)%q

def solve(raw):
    n=int(raw)
    if n>1073741823: return "0"
    a=catalan_residue(n,2,4)
    b=catalan_residue(n,5,4)
    return str(a+16*((b-a)*586%625))

if __name__=='__main__':
    print(solve(sys.stdin.read()))
