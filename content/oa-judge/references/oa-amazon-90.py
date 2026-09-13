def solve(d):
    a=list(map(int,d[1:]))
    while len(a)>2:a=[(a[i]+a[i+1])%10 for i in range(len(a)-1)]
    return ''.join(map(str,a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
