def solve(data):
    best = [0,-1,-1,-1]
    for digit in sorted(map(int, data[1:]), reverse=True):
        for count in range(3,0,-1):
            if best[count-1] >= 0:
                best[count] = max(best[count], best[count-1]*10+digit)
    return max(best[1:])

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
