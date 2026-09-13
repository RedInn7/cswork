def solve(d):
    a=list(map(int,d[1:]));n=len(a)
    if n==1:return '1'
    sieve=bytearray(b'\1')*n;sieve[0]=sieve[1]=0
    for p in range(2,int(n**0.5)+1):
        if sieve[p]:sieve[p*p:n:p]=b'\0'*(((n-1-p*p)//p)+1)
    packed=bytearray((n+7)//8)
    for i in range(2,n):
        if sieve[i]:packed[i//8]|=1<<(i%8)
    primes=int.from_bytes(packed,'little')|2;pending=1;i=0
    while pending:
        if pending&1==0:
            gap=(pending&-pending).bit_length()-1;pending>>=gap;i+=gap
        if i==n-1:return '1'
        bound=min(a[i],n-1-i)
        if bound>=2:pending|=primes&((1<<(bound+1))-1)
        if pending.bit_length()==n-i:return '1'
        pending>>=1;i+=1
    return '0'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
