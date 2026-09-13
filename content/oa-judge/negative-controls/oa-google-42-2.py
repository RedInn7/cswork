def solve(data):
    n,k=map(int,data[:2]);a=sorted(map(int,data[2:]),reverse=True)
    return str(sum(a[:k-1]))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
