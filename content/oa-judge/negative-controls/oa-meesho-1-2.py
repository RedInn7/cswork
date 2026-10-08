import sys

MOD=1000000007

def solve(raw):
    s,n,x,y=raw.split()
    n,x,y=int(n),int(x),int(y)
    if x>n or y>n:
        return '0'
    f=[0]*(n+1)
    f[x]=1
    last=[[0]*(n+1),[0]*(n+1)]
    for ch in s:
        direction=int(ch=='r')
        added=([0]+f[:-1]) if direction else (f[1:]+[0])
        f=[(f[j]+added[j]-last[direction][j])%MOD for j in range(n+1)]
        last[direction]=added
    return str((f[y]-int(x==y))%MOD)

if __name__=='__main__':
    print(solve(sys.stdin.read()))
