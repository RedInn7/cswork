class Node:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


class LinkedList:
    """单链表 / Singly linked list with head and tail pointers."""

    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def push_front(self, x: int) -> None:
        pass  # TODO

    def push_back(self, x: int) -> None:
        pass  # TODO

    def pop_front(self) -> int:
        return 0  # TODO

    def insert(self, i: int, x: int) -> None:
        pass  # TODO

    def remove(self, x: int) -> bool:
        return False  # TODO

    def reverse(self) -> None:
        pass  # TODO

    def size(self) -> int:
        return 0  # TODO

    def values(self) -> list:
        return []  # TODO: 从 head 走到尾 / walk from head to the end


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    lst = LinkedList()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"push_front":
            lst.push_front(int(next(it)))
        elif op == b"push_back":
            lst.push_back(int(next(it)))
        elif op == b"pop_front":
            out.append(str(lst.pop_front()))
        elif op == b"insert":
            i = int(next(it))
            lst.insert(i, int(next(it)))
        elif op == b"remove":
            out.append("1" if lst.remove(int(next(it))) else "0")
        elif op == b"reverse":
            lst.reverse()
        elif op == b"size":
            out.append(str(lst.size()))
        else:
            out.append(" ".join(map(str, lst.values())) or "empty")
    print("\n".join(out))


main()
