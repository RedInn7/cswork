# 右侧少计一个处理器
def solve(raw):
    n,m,k=map(int,raw.split());mod=10**9+7
    def side(cnt,x):
        full=min(cnt,x-1);return ((x-1+x-full)*full)//2+max(0,cnt-full)
    def need(x):return x+side(k-1,x)+side(max(0,n-k-1),x)
    lo,hi,ans=1,m,1
    while lo<=hi:
        mid=(lo+hi)//2
        if need(mid)<=m:ans=mid;lo=mid+1
        else:hi=mid-1
    return str(ans)
