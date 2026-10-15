class RingDeque:
    """双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity]."""

    def __init__(self):
        self._data = [0] * 4
        self._head = 0
        self._size = 0

    def _grow(self):
        cap = len(self._data)
        data = [0] * (2 * cap)
        for i in range(self._size):
            data[i] = self._data[(self._head + i) % cap]
        self._data, self._head = data, 0

    def push_front(self, x: int) -> None:
        if self._size == len(self._data):
            self._grow()
        self._head = (self._head - 1 + len(self._data)) % len(self._data)
        self._data[self._head] = x
        self._size += 1

    def push_back(self, x: int) -> None:
        if self._size == len(self._data):
            self._grow()
        self._data[(self._head + self._size) % len(self._data)] = x
        self._size += 1

    def pop_front(self) -> int:
        x = self._data[self._head]
        self._head = (self._head + 1) % len(self._data)
        self._size -= 1
        return x

    def pop_back(self) -> int:
        x = self.back()
        self._size -= 1
        return x

    def front(self) -> int:
        return self._data[self._head]

    def back(self) -> int:
        return self.get(self._size - 1)

    def get(self, i: int) -> int:
        return self._data[(self._head + i) % len(self._data)]

    def size(self) -> int:
        return self._size


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
