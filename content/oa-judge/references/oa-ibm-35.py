def solve(d):
    a,b,c,x,y=map(int,d)
    return str(min(z*c+max(0,x-z)*a+max(0,y-z)*b for z in (0,min(x,y),max(x,y))))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
