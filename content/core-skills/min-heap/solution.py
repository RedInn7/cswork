class MinHeap:
    """最小堆 / Binary min-heap on an array: parent (i - 1) // 2, children 2i + 1 and 2i + 2."""

    def __init__(self):
        self._a = []

    def _sift_up(self, i):
        a = self._a
        while i > 0 and a[i] < a[(i - 1) // 2]:
            p = (i - 1) // 2
            a[i], a[p] = a[p], a[i]
            i = p

    def _sift_down(self, i):
        a, n = self._a, len(self._a)
        while 2 * i + 1 < n:
            c = 2 * i + 1
            if c + 1 < n and a[c + 1] < a[c]:
                c += 1
            if not a[c] < a[i]:
                break
            a[i], a[c] = a[c], a[i]
            i = c

    def push(self, x: int) -> None:
        self._a.append(x)
        self._sift_up(len(self._a) - 1)

    def pop(self) -> int:
        a = self._a
        top = a[0]
        last = a.pop()
        if a:
            a[0] = last
            self._sift_down(0)
        return top

    def top(self) -> int:
        return self._a[0]

    def size(self) -> int:
        return len(self._a)

    def build(self, values: list) -> None:
        self._a = list(values)
        for i in range(len(self._a) // 2 - 1, -1, -1):
            self._sift_down(i)

    def dump(self) -> list:
        return list(self._a)


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    heap = MinHeap()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"push":
            heap.push(int(next(it)))
        elif op == b"build":
            heap.build([int(next(it)) for _ in range(int(next(it)))])
        elif op == b"size":
            out.append(str(heap.size()))
        elif op == b"dump":
            out.append(" ".join(map(str, heap.dump())) or "empty")
        elif heap.size() == 0:
            out.append("empty")
        elif op == b"pop":
            out.append(str(heap.pop()))
        else:
            out.append(str(heap.top()))
    print("\n".join(out))


main()
