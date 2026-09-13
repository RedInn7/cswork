def solve(d):
    n=int(d[0]);a=[list(map(int,d[1+i*n:1+(i+1)*n])) for i in range(4)]
    order=sorted(range(n),key=lambda i:(-3*a[0][i],-a[2][i]+a[3][i],i))
    return f'{order[0]} {order[1]}'

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
