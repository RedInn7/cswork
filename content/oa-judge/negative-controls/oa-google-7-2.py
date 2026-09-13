def solve(data):
    answer = 0; previous = 0
    for current in map(int, data[1:]):
        answer += current
        previous = current
    return answer

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
