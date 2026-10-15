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
        self.head = Node(x, self.head)
        if self.tail is None:
            self.tail = self.head
        self.length += 1

    def push_back(self, x: int) -> None:
        node = Node(x)
        if self.tail is None:
            self.head = node
        else:
            self.tail.next = node
        self.tail = node
        self.length += 1

    def pop_front(self) -> int:
        node = self.head
        self.head = node.next
        if self.head is None:
            self.tail = None
        self.length -= 1
        return node.val

    def insert(self, i: int, x: int) -> None:
        if i == 0:
            return self.push_front(x)
        if i == self.length:
            return self.push_back(x)
        prev = self.head
        for _ in range(i - 1):
            prev = prev.next
        prev.next = Node(x, prev.next)
        self.length += 1

    def remove(self, x: int) -> bool:
        prev, node = None, self.head
        while node is not None and node.val != x:
            prev, node = node, node.next
        if node is None:
            return False
        if prev is None:
            self.head = node.next
        else:
            prev.next = node.next
        if node is self.tail:
            self.tail = prev
        self.length -= 1
        return True

    def reverse(self) -> None:
        prev, node = None, self.head
        self.tail = node
        while node is not None:
            node.next, prev, node = prev, node, node.next
        self.head = prev

    def size(self) -> int:
        return self.length

    def values(self) -> list:
        out, node = [], self.head
        while node is not None:
            out.append(node.val)
            node = node.next
        return out


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
