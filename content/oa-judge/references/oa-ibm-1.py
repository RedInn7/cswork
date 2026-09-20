def solve(d):
    n=int(d[0]);return str(pow(2,n*(n-1)//2,1000000007))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
