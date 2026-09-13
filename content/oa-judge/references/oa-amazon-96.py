def solve(d):
    a=list(map(int,d[1:]));threshold=max(a)-1;return str(sum(v>=threshold for v in a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
