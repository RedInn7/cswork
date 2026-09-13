def solve(data):
    n = int(data[0]); a = list(map(int, data[1:])); i = 0; answer = 0
    while i + 3 < n:
        if a[i] + a[i+1] + a[i+2] == 0:
            answer += 1
            i += 3
        else:
            i += 1
    return answer

if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read().split()))
