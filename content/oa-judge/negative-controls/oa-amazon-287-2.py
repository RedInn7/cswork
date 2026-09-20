def solve(d):
    from collections import Counter
    a=list(map(int,d[1:]));f=max(Counter(a).values());return str(len(set(a)))

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
