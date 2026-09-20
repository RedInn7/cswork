def solve(d):
    n,m=map(int,d[:2]);a=list(map(int,d[2:2+n]));out=[None]*n;floor=0
    for i in range(m):
        t,p,x=map(int,d[2+n+3*i:5+n+3*i])
        if t==2:floor=max(floor,x)
        elif out[p-1] is None:out[p-1]=max(x,floor)
    for i in range(n):
        if out[i] is None:out[i]=max(a[i],floor)
    return str(n)+'\n'+' '.join(map(str,out))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
