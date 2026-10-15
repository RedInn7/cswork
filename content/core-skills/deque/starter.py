class RingDeque:
    """双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity]."""

    def __init__(self):
        self._data = [0] * 4
        self._head = 0
        self._size = 0

    def push_front(self, x: int) -> None:
        pass  # TODO

    def push_back(self, x: int) -> None:
        pass  # TODO

    def pop_front(self) -> int:
        return 0  # TODO

    def pop_back(self) -> int:
        return 0  # TODO

    def front(self) -> int:
        return 0  # TODO

    def back(self) -> int:
        return 0  # TODO

    def get(self, i: int) -> int:
        return 0  # TODO

    def size(self) -> int:
        return 0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    dq = RingDeque()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"push_front":
            dq.push_front(int(next(it)))
        elif op == b"push_back":
            dq.push_back(int(next(it)))
        elif op == b"get":
            out.append(str(dq.get(int(next(it)))))
        elif op == b"size":
            out.append(str(dq.size()))
        elif dq.size() == 0:
            out.append("empty")
        elif op == b"pop_front":
            out.append(str(dq.pop_front()))
        elif op == b"pop_back":
            out.append(str(dq.pop_back()))
        elif op == b"front":
            out.append(str(dq.front()))
        else:
            out.append(str(dq.back()))
    print("\n".join(out))


main()
