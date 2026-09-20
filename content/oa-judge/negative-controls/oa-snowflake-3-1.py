def solve(d):
    s,t=d[:2];k=int(d[2]);n=len(s)
    if n!=len(t):return '0'
    c=sum(s[j:]+s[:j]==t for j in range(n));a,b=int(s==t),int(s!=t);m=(c,c,n-c,n-c);P=1000000007
    while k:
        x,y,z,w=m
        if k&1:a,b=(x*a+y*b)%P,(z*a+w*b)%P
        m=((x*x+y*z)%P,(x*y+y*w)%P,(z*x+w*z)%P,(z*y+w*w)%P);k//=2
    return str(a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
