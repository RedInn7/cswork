from itertools import islice
def solve(d):
    n,q=map(int,d[:2]);a=list(map(int,d[2:2+n*n]));origin=(0,0);dr=(1,0);dc=(0,1)
    for token in islice(d,2+n*n,None):
        kind=int(token)
        if kind==0:origin=(origin[1],n-1-origin[0]);dr=(dr[1],-dr[0]);dc=(dc[1],-dc[0])
        elif kind==1:origin=origin[::-1];dr=dr[::-1];dc=dc[::-1]
        else:origin=(n-1-origin[1],n-1-origin[0]);dr=(-dr[1],-dr[0]);dc=(-dc[1],-dc[0])
    result=[[0]*n for _ in range(n)]
    for i in range(n):
        for j in range(n):result[origin[0]+i*dr[0]+j*dc[0]][origin[1]+i*dr[1]+j*dc[1]]=a[i*n+j]
    return '\n'.join(' '.join(map(str,row)) for row in result)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
