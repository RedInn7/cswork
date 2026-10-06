import sys
from bisect import bisect_left, bisect_right

def solve(raw):
    data = list(map(int, raw.split()))
    n, min_order = data[0], data[1]
    domino = data[2:2+n]
    remove = data[2+n:2+2*n]

    def lis_after(k):
        alive = bytearray([1]) * n
        for i in range(k):
            alive[remove[i]] = 0
        tails = []
        for i, value in enumerate(domino):
            if alive[i]:
                pos = bisect_right(tails, value)
                if pos == len(tails):
                    tails.append(value)
                else:
                    tails[pos] = value
        return len(tails)

    low, high, answer = 0, n, -1
    while low <= high:
        mid = (low + high) // 2
        if lis_after(mid) >= min_order:
            answer = mid
            low = mid + 1
        else:
            high = mid - 1
    return str(answer)

if __name__ == "__main__":
    print(solve(sys.stdin.buffer.read().decode()))
