def solve(raw):
    d=list(map(int,raw.split()));n,m=d[:2];a=d[2:2+n];b=d[2+n:];za=a.count(0);zb=b.count(0);sa=sum(a)+za;sb=sum(b)+zb;target=max(sa,sb)
    if (not za and sa!=target) or (not zb and sb!=target):return '-1'
    return str(target)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
