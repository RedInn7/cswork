def solve(d):
    n,armor=map(int,d[:2]);a=list(map(int,d[2:]));return str(sum(a)-armor+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
