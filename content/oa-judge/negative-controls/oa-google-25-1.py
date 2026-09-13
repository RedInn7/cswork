def solve(data):
    counts={}
    for v in map(int,data[1:]):counts[v]=counts.get(v,0)+1
    return str(len(counts))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
