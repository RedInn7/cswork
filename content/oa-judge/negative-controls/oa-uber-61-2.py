def solve(d):
    rows=[(int(d[i]),int(d[i+1])) for i in range(1,len(d),2)];limit=max(b for a,b in rows);sieve=bytearray(b'\1')*(limit+1);sieve[0:2]=b'\0\0'
    for p in range(2,int(limit**0.5)+1):
        if sieve[p]:sieve[p*p:limit+1:p]=b'\0'*((limit-p*p)//p+1)
    prefix=[0]*(limit+1)
    for p in range(1,limit+1):prefix[p]=prefix[p-1]+(p if sieve[p] else 0)
    result=1
    for left,right in rows:result=result*(prefix[right]-prefix[left])%1000000007
    return str(result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
