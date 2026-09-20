def solve(d):
    a,b,c,x,y=map(int,d)
    return str(x*a+y*b)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
