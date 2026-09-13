def solve(d):
    a=sorted(map(int,d[1:]),reverse=True); groups=len(a)//3
    return str(sum(a[3*i+1] for i in range(groups)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
