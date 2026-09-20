def solve(raw):
    n=int(raw);total=0;mod=1000000007
    for j in range(1,n+1):
        q,r=divmod(n,j);total=(total+q*j*(j-1)//2+r*(r+1)//2)%mod
    return str(total%mod)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
