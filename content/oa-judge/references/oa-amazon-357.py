def solve(raw):
    import sys
    from math import comb
    if hasattr(sys,'set_int_max_str_digits'):sys.set_int_max_str_digits(0)
    d=list(map(int,raw.split()));n=d[0];f=[0]*(n+1)
    for v in d[1:]:f[v]+=1
    for i in range(1,n+1):f[i]+=f[i-1]
    answer=sum(f[r]==r and f[n-r]==r for r in range(n//2+1))
    start=n//2+1;M=f[start]-f[n-start];K=start-f[n-start];value=comb(M,K) if 0<=K<=M else 0
    for r in range(start,n+1):
        targetM=f[r]-f[n-r];targetK=r-f[n-r]
        while M<targetM:
            M+=1
            if K==M:value=1
            elif 0<=K<M:value=value*M//(M-K)
            else:value=0
        while K<targetK:
            K+=1
            if K==0:value=1
            elif 0<K<=M:value=value*(M-K+1)//K
            else:value=0
        answer+=value
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
