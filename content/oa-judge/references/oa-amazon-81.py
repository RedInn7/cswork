def solve(d):
    a=sorted(map(int,d[1:]));return str(sum(a[len(a)//2:]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
