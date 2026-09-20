def solve(d):
    n=int(d[0]);return str(3*pow(3,n//2-1,1000000007)%1000000007)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
