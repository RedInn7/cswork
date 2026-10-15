class MinHeap:
    """最小堆 / Binary min-heap on an array: parent (i - 1) // 2, children 2i + 1 and 2i + 2."""

    def __init__(self):
        self._a = []

    def push(self, x: int) -> None:
        pass  # TODO: 放到末尾后上浮 / append, then sift up

    def pop(self) -> int:
        return 0  # TODO: 末尾移到堆顶后下沉 / move the last to the top, then sift down

    def top(self) -> int:
        return 0  # TODO

    def size(self) -> int:
        return 0  # TODO

    def build(self, values: list) -> None:
        pass  # TODO: Floyd 建堆 / Floyd's construction

    def dump(self) -> list:
        return []  # TODO


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
