def solve(d):
    rate=int(d[1]);items=d[2]
    return str(items.count('A')+(items.count('P')//rate))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
