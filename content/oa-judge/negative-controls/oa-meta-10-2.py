def solve(data):
    left,right=map(int,data)
    return str(sum(len(set(str(v)))==2 for v in range(left,right+1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
