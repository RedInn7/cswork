def solve(d):
    from collections import Counter
    counts=Counter(map(int,d[1:]));return str(min(sum(count*((-v)%p) for v,count in counts.items()) for p in range(1,max(2,max(counts))+1)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
