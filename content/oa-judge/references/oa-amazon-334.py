def solve(d):
    a=list(map(int,d[1:]));fall=rise=0
    for x,y in zip(a,a[1:]):
        if y<x:fall+=x-y
        else:rise+=y-x
    return str(fall+rise+abs(a[0]-fall))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
