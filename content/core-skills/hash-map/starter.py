class HashMap:
    """哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75."""

    def __init__(self):
        self._table = [[] for _ in range(8)]  # 每个桶是一串 [key, value] / each bucket chains [key, value] pairs
        self._size = 0

    def put(self, key: int, value: int) -> None:
        pass  # TODO

    def get(self, key: int) -> int:
        return -1  # TODO

    def remove(self, key: int) -> bool:
        return False  # TODO

    def size(self) -> int:
        return 0  # TODO

    def buckets(self) -> int:
        return 0  # TODO


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
