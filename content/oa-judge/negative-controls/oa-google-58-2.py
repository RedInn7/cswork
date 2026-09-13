def solve(data):
    counts={}
    for op in data[1:]:
        if True:counts[op[1:]]=counts.get(op[1:],0)+1
    return min(counts,key=lambda room:(-counts[room],room))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
