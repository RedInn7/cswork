def solve(d):
    m,n=map(int,d[:2]);a=sorted(map(int,d[2:2+m]),reverse=True);c=sorted(map(int,d[2+m:]));cursor=saving=best=0
    for j,threshold in enumerate(c):
        if cursor+threshold+2>m:break
        if j==n-1:
            best=max(best,saving+a[-2]+a[-1]);break
        cursor+=threshold;saving+=a[cursor]+a[cursor+1];cursor+=2;best=max(best,saving)
    return str(sum(a)-best)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
