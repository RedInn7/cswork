def solve(d):
    total=groups=0
    for v in sorted(map(int,d[1:])):
        total+=v
        while total>=(groups+1)*(groups+2)//2:groups+=1
    return str(groups)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
