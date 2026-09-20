def solve(d):
    a=list(map(int,d[1:]));l=a.index(min(a));r=a.index(max(a));return str(l+len(a)-1-r)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
