def solve(d):
    a=sorted(map(int,d[1:]),reverse=True);return str(sum(a[2::2]) if len(a)%2 else sum(a[1::2]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
