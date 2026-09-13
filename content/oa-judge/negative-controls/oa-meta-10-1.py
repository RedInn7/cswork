def solve(data):
    left,right=map(int,data)
    return str(sum(len(set(str(v)))==3 for v in range(left,right)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
