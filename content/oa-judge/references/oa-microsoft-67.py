from collections import Counter
def solve(d):
    counts=Counter(map(int,d[1:]));highest=max(counts)
    return str(1+sum(min(v,2) for key,v in counts.items() if key!=highest))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
