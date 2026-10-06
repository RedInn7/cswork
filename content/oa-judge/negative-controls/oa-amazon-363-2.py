from bisect import bisect_left


class Fenwick:
    def __init__(self, size):
        self.tree = [0] * (size + 1)

    def add(self, index, delta):
        while index < len(self.tree):
            self.tree[index] += delta
            index += index & -index

    def prefix_sum(self, index):
        total = 0
        while index > 0:
            total += self.tree[index]
            index -= index & -index
        return total


def count_spikes(prices, k):
    n = len(prices)
    ordered = sorted(set(prices))
    ranks = [bisect_left(ordered, value) + 1 for value in prices]
    left_less = [0] * n
    right_less = [0] * n

    bit = Fenwick(len(ordered))
    for i, rank in enumerate(ranks):
        left_less[i] = bit.prefix_sum(rank - 1)
        bit.add(rank, 1)

    bit = Fenwick(len(ordered))
    for i in range(n - 1, -1, -1):
        rank = ranks[i]
        right_less[i] = bit.prefix_sum(rank - 1)
        bit.add(rank, 1)

    return sum(left_less[i] > k and right_less[i] > k for i in range(n))


def solve(raw):
    data = list(map(int, raw.split()))
    n, k = data[0], data[1]
    prices = data[2:2 + n]
    return str(count_spikes(prices, k))


if __name__ == "__main__":
    import sys
    print(solve(sys.stdin.read()))
