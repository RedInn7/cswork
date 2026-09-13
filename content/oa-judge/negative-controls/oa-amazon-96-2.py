def solve(d):
    a=list(map(int,d[1:]));threshold=max(a)-1;return str(len(a))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
