def solve(data):
    from collections import Counter
    n,k=map(int,data[:2]); counts=Counter(data[2:])
    return str(max(counts.values()) if max(counts.values())>k else 0)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
