def solve(d):
    a=list(map(int,d[1:])); degree=len(a)-2
    small=[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]]
    def coefficient(i):
        n=degree; k=i; mod5=1
        while n or k:
            u=n%5; v=k%5
            if v>u: mod5=0; break
            mod5=mod5*small[u][v]%5; n//=5; k//=5
        mod2=1 if i&degree==i else 0
        return mod5 if mod5%2==mod2 else mod5+5
    first=second=0
    for i in range(degree+1):
        c=coefficient(i); first=(first+c*a[i])%10; second=(second+c*a[i+1])%10
    return str(first)+str(second)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
