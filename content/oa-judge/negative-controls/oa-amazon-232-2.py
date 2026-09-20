def solve(d):
    n,armor=map(int,d[:2]);a=list(map(int,d[2:]));return str(sum(max(0,v-armor) for v in a)+1)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
