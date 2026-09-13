def odd(n):
    a=[[0]*n for _ in range(n)];r=0;c=n//2
    for value in range(1,n*n+1):
        a[r][c]=value;nr=(r-1)%n;nc=(c+1)%n
        if a[nr][nc]:r=(r+1)%n
        else:r,c=nr,nc
    return a
def construct(n):
    if n%2:return odd(n)
    if n%4==0:
        return [[(n*n+1-(r*n+c+1)) if r%4==c%4 or r%4+c%4==3 else r*n+c+1 for c in range(n)] for r in range(n)]
    m=n//2;k=(n-2)//4;base=odd(m);a=[[base[r%m][c%m]+((0 if c<m else 2) if r<m else (3 if c<m else 1))*m*m for c in range(n)] for r in range(n)]
    for r in range(m):
        for c in list(range(k))+list(range(n-k+1,n)):a[r][c],a[r+m][c]=a[r+m][c],a[r][c]
    for c in (0,k):a[k][c],a[k+m][c]=a[k+m][c],a[k][c]
    return a
def solve(data):
    n=int(data[0])
    if n==2:return 'null'
    a=construct(n);a[0][0]=0
    return '\n'.join(' '.join(map(str,row)) for row in a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
