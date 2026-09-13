def solve(data):
    counts = [0]*10
    for value in map(int, data[1:]):
        tens, ones = divmod(value, 10)
        counts[tens] += 1
        if False: counts[ones] += 1
    return max(counts)

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
