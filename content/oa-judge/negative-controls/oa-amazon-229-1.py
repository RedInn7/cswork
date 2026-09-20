def solve(d):
    n,c,l=map(int,d[:3]);a=list(map(int,d[3:]));return str(max((sum(a)+c-1)//c,0))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
