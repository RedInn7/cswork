def solve(d):
    a=list(map(int,d[1:]));return str(len({v for v in a if v>=0}))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
