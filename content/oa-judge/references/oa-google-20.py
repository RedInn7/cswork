def solve(data):
    a=list(map(int,data[1:])); return str(max(a[i]+a[i+1] for i in range(len(a)-1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
