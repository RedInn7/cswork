def solve(d):
    a=list(map(int,d[1:]));return str(sum(v>0 for v in a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
