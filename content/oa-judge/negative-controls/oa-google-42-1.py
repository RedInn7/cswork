def solve(data):
    n,k=map(int,data[:2]);a=sorted(map(int,data[2:]),reverse=False)
    return str(sum(a[:k]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
