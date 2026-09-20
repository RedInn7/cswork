def solve(d):
    n,h=map(int,d[:2]);capacity=sorted(h-int(v) for v in d[2:2+n]);optional=sorted(map(int,d[2+n:]));j=0
    for cap in capacity:
        if j<n and optional[j]<cap:j+=1
    return str(j)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
