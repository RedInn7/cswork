from math import isqrt
def solve(d):
    small,big=map(int,d);side=isqrt(small+4*big)
    if side%2 and small<2*side-1:side-=1
    return str(side)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
