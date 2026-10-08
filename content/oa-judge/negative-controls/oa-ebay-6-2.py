import sys

def solve(raw):
    data = list(map(int, raw.split()))
    a = data[1:]
    answer = 0
    for i in range(len(a)):
        x = a[i]
        if x == 0:
            continue
        answer += x
        for j in range(i, len(a)):
            if a[j] <= x:
                break
            a[j] -= x
    return str(answer)

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
