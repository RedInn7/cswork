def solve(d):
    n,extra=map(int,d[:2]); a=list(map(int,d[2:])); total=sum(a)+extra
    return str(max(max(a),(total+n-1)//n))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
