def solve(raw):
    from math import isqrt
    d=list(map(int,raw.split()));out=[]
    for i in range(d[0]):
        a,b=d[1+2*i:3+2*i];s=a+b;r=isqrt(s)
        def f(k):return k-1+(a+k-1)//k+(b+k-1)//k
        best=min(f(r),f(r+1));q=isqrt((best+1)**2-4*s)
        for k in range(max(1,(best+1-q)//2-1),(best+1+q)//2+2):best=min(best,f(k))
        out.append(str(best+1))
    return '\n'.join(out)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
