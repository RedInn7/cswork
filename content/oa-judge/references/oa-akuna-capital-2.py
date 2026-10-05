import sys
def solve(raw):
    t=list(map(int,raw.split())); n=t[0]; a=t[1:1+n]
    left=[0]*n; right=[0]*n
    cur=best=a[0]; left[0]=best
    for i in range(1,n):
        cur=max(a[i],cur+a[i]); best=max(best,cur); left[i]=best
    cur=best=a[-1]; right[-1]=best
    for i in range(n-2,-1,-1):
        cur=max(a[i],cur+a[i]); best=max(best,cur); right[i]=best
    return str(max(left[i]+right[i+1] for i in range(n-1)))
if __name__ == '__main__':
    import sys
    print(solve(sys.stdin.read()))
