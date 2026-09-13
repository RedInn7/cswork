def solve(data):
    n=int(data[0]); a,b=0,1
    while b<n:a,b=b,a+b
    return str(a)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
