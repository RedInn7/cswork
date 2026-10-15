class Node:
    def __init__(self, key=0, value=0):
        self.key, self.value = key, value
        self.prev = self.next = None


class LRUCache:
    """LRU 缓存 / LRU cache: a hash map to the nodes of a doubly linked list, most recent first."""

    def __init__(self, capacity: int):
        self.capacity = capacity
        self.nodes = {}
        self.head, self.tail = Node(), Node()  # sentinels
        self.head.next, self.tail.prev = self.tail, self.head

    def _unlink(self, node):
        node.prev.next, node.next.prev = node.next, node.prev

    def _push_front(self, node):
        node.prev, node.next = self.head, self.head.next
        self.head.next.prev = node
        self.head.next = node

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1
        self._unlink(node)
        self._push_front(node)
        return node.value

    def put(self, key: int, value: int) -> int:
        node = self.nodes.get(key)
        if node is not None:
            node.value = value
            self._unlink(node)
            self._push_front(node)
            return -1
        node = self.nodes[key] = Node(key, value)
        self._push_front(node)
        if len(self.nodes) <= self.capacity:
            return -1
        oldest = self.tail.prev
        self._unlink(oldest)
        del self.nodes[oldest.key]
        return oldest.key

    def keys(self) -> list:
        out, node = [], self.head.next
        while node is not self.tail:
            out.append(node.key)
            node = node.next
        return out


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
