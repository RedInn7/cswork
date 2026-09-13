def solve(d):
    n,p=map(int,d[:2]);a=list(map(int,d[2:]));cap=max(a)+p
    for i in range(n):
        put=min(p,cap-a[i]);a[i]+=put;p-=put
    return ' '.join(map(str,a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
