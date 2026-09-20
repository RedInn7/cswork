def solve(d):
    n,minimum,lo,hi=map(int,d[:4]);m=sum(lo<=int(v)<=hi for v in d[4:]);choose=1;answer=0
    for k in range(m+1):
        if k>=minimum:answer+=choose
        if k<m:choose=choose*(m-k)//(k+1)
    return str(answer%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
