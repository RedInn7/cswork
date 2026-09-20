def solve(raw):
    d=list(map(int,raw.split()));n,k=d[:2];a=d[2:];del d
    for i in range(n-k-1,-1,-1):a[i]+=a[i+k]
    return str(max(0,max(a)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
