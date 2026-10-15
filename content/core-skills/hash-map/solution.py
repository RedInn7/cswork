class HashMap:
    """哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75."""

    def __init__(self):
        self._table = [[] for _ in range(8)]
        self._size = 0

    def _bucket(self, key, table):
        # Multiplicative hashing spreads keys that share low bits.
        return table[((key * 2654435761) & 0xFFFFFFFF) % len(table)]

    def put(self, key: int, value: int) -> None:
        bucket = self._bucket(key, self._table)
        for pair in bucket:
            if pair[0] == key:
                pair[1] = value
                return
        bucket.append([key, value])
        self._size += 1
        if self._size * 4 > len(self._table) * 3:
            table = [[] for _ in range(2 * len(self._table))]
            for chain in self._table:
                for pair in chain:
                    self._bucket(pair[0], table).append(pair)
            self._table = table

    def get(self, key: int) -> int:
        for k, v in self._bucket(key, self._table):
            if k == key:
                return v
        return -1

    def remove(self, key: int) -> bool:
        bucket = self._bucket(key, self._table)
        for i, pair in enumerate(bucket):
            if pair[0] == key:
                bucket[i] = bucket[-1]
                bucket.pop()
                self._size -= 1
                return True
        return False

    def size(self) -> int:
        return self._size

    def buckets(self) -> int:
        return len(self._table)


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    table = HashMap()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"put":
            k = int(next(it))
            table.put(k, int(next(it)))
        elif op == b"get":
            out.append(table.get(int(next(it))))
        elif op == b"remove":
            out.append(1 if table.remove(int(next(it))) else 0)
        elif op == b"size":
            out.append(table.size())
        else:
            out.append(table.buckets())
    print("\n".join(map(str, out)))


main()
