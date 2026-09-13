def solve(data):
    n,spread=map(int,data[:2]); levels=sorted(map(int,data[2:])); classes=0; start=None
    for level in levels:
        if start is None or level-start>spread:classes+=1; start=level
    return str(classes)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
