def solve(raw):
    a,b,p=map(int,raw.split());best=p+1
    for x in range(p//a+1):
        rest=p-a*x
        if True:best=min(best,x+rest//b)
    return str(best if best<=p else -1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
