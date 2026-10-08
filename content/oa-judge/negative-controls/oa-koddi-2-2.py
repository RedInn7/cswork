import sys

def solve(raw):
    data = list(map(int, raw.split()))
    n, bird = data[:2]
    forest = data[2:]
    left = [i for i in range(bird-1, -1, -1) if forest[i]]
    right = [i for i in range(bird+1, n) if forest[i]]
    answer = []
    total = 0
    while total <= 100:
        side = right if len(answer) % 2 == 0 else left
        if len(answer) // 2 >= len(side):
            break
        index = side[len(answer) // 2]
        answer.append(index)
        total += forest[index]
    return ' '.join(map(str, answer))

if __name__ == '__main__':
    print(solve(sys.stdin.read()))
