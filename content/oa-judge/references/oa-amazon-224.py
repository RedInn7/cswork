def solve(d):
    n,total=map(int,d[:2]);a=sorted(map(int,d[2:]));gap=a[0]+total-a[-1]
    for x,y in zip(a,a[1:]):gap=max(gap,y-x)
    return str(total-gap)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
