# 左侧少计一个处理器
import sys
def solve(raw):
    n,m,k=map(int,raw.split());mod=10**9+7
    def side(cnt,x):
        full=min(cnt,x-1);return ((x-1+x-full)*full)//2+max(0,cnt-full)
    def need(x):return x+side(max(0,k-2),x)+side(n-k,x)
    lo,hi,ans=1,m,1
    while lo<=hi:
        mid=(lo+hi)//2
        if need(mid)<=m:ans=mid;lo=mid+1
        else:hi=mid-1
    return str(ans)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
