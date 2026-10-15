class DynamicArray:
    """动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter."""

    def __init__(self):
        # TODO: 定长存储 [0] * capacity 加一个长度 / fixed-size storage plus a length
        pass

    def push(self, x: int) -> None:
        pass  # TODO

    def pop(self) -> int:
        return 0  # TODO

    def get(self, i: int) -> int:
        return 0  # TODO

    def set(self, i: int, x: int) -> None:
        pass  # TODO

    def insert(self, i: int, x: int) -> None:
        pass  # TODO

    def erase(self, i: int) -> int:
        return 0  # TODO

    def size(self) -> int:
        return 0  # TODO

    def capacity(self) -> int:
        return 0  # TODO


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
