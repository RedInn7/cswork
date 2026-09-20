def solve(raw):
    from math import isqrt
    values=list(map(int,raw.split()))[1:];limit=46340;sieve=bytearray(b'\x01')*(limit+1);sieve[0:2]=b'\x00\x00'
    for p in range(2,isqrt(limit)+1):
        if sieve[p]:sieve[p*p:limit+1:p]=b'\x00'*((limit-p*p)//p+1)
    primes=[p for p in range(2,limit+1) if sieve[p]];cache={};out=[]
    for value in values:
        if value not in cache:
            ok=value>=2
            if ok:
                for p in primes:
                    if p*p>=value:break
                    if value%p==0:ok=False;break
            cache[value]='Prime' if ok else 'Composite'
        out.append(cache[value])
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
