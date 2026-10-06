def solve(data):
    n = int(data[0]); points = list(map(int, data[1:n+1])); tokens = data[n+1]
    score = 0
    for i in range(n):
        if tokens[i] == 'T':
            score += points[i]
            if i > 0 and tokens[i-1] == 'T':
                score += 0
    return score

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
