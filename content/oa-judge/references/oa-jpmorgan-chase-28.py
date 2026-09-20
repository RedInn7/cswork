def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=sorted(d[2:],reverse=True)
    if sum(a)<m:return '-1'
    a.append(0);answer=0
    for i in range(n):
        width=i+1;high=a[i];low=a[i+1];available=(high-low)*width
        take=min(m,available);levels,rest=divmod(take,width)
        answer+=width*(high+high-levels+1)*levels//2+rest*(high-levels)
        m-=take
        if not m:break
    return str(answer)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
