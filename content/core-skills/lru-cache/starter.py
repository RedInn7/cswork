class Node:
    def __init__(self, key=0, value=0):
        self.key, self.value = key, value
        self.prev = self.next = None


class LRUCache:
    """LRU 缓存 / LRU cache: a hash map to the nodes of a doubly linked list, most recent first."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.nodes = {}  # key -> Node
        # TODO: 双向链表（建议用两个哨兵节点） / the doubly linked list (two sentinels help)

    def get(self, key: int) -> int:
        return -1  # TODO

    def put(self, key: int, value: int) -> int:
        return -1  # TODO: 返回被淘汰的键，没有淘汰返回 -1 / return the evicted key, or -1

    def keys(self) -> list:
        return []  # TODO: 从最近到最久 / most recent first


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    cache = LRUCache(int(next(it)))
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"get":
            out.append(str(cache.get(int(next(it)))))
        elif op == b"put":
            k = int(next(it))
            out.append(str(cache.put(k, int(next(it)))))
        else:
            out.append(" ".join(map(str, cache.keys())) or "empty")
    print("\n".join(out))


main()
