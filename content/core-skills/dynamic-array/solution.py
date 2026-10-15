class DynamicArray:
    """动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter."""

    def __init__(self):
        self._data = [0]
        self._size = 0

    def _resize(self, capacity):
        data = [0] * capacity
        for i in range(self._size):
            data[i] = self._data[i]
        self._data = data

    def push(self, x: int) -> None:
        self.insert(self._size, x)

    def pop(self) -> int:
        return self.erase(self._size - 1)

    def get(self, i: int) -> int:
        return self._data[i]

    def set(self, i: int, x: int) -> None:
        self._data[i] = x

    def insert(self, i: int, x: int) -> None:
        if self._size == len(self._data):
            self._resize(2 * len(self._data))
        for j in range(self._size, i, -1):
            self._data[j] = self._data[j - 1]
        self._data[i] = x
        self._size += 1

    def erase(self, i: int) -> int:
        x = self._data[i]
        for j in range(i, self._size - 1):
            self._data[j] = self._data[j + 1]
        self._size -= 1
        if len(self._data) > 1 and self._size * 4 <= len(self._data):
            self._resize(len(self._data) // 2)
        return x

    def size(self) -> int:
        return self._size

    def capacity(self) -> int:
        return len(self._data)


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    arr = DynamicArray()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"push":
            arr.push(int(next(it)))
        elif op == b"pop":
            out.append(arr.pop())
        elif op == b"get":
            out.append(arr.get(int(next(it))))
        elif op == b"set":
            i = int(next(it))
            arr.set(i, int(next(it)))
        elif op == b"insert":
            i = int(next(it))
            arr.insert(i, int(next(it)))
        elif op == b"erase":
            out.append(arr.erase(int(next(it))))
        elif op == b"size":
            out.append(arr.size())
        else:
            out.append(arr.capacity())
    print("\n".join(map(str, out)))


main()
