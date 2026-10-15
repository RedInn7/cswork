class Node:
    __slots__ = ("children", "pass_count", "end_count")

    def __init__(self):
        self.children = [None] * 26
        self.pass_count = 0  # 经过这里的单词数 / words through this node
        self.end_count = 0  # 在这里结束的单词数 / words ending here


class Trie:
    """字典树 / Trie of lowercase words, counting repeated inserts."""

    def __init__(self):
        self.root = Node()

    def insert(self, word: str) -> None:
        pass  # TODO

    def erase(self, word: str) -> bool:
        return False  # TODO

    def search(self, word: str) -> bool:
        return False  # TODO

    def count_prefix(self, p: str) -> int:
        return 0  # TODO


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    tokens = sys.stdin.read().split()
    trie = Trie()
    out = []
    for k in range(int(tokens[0])):
        op, word = tokens[1 + 2 * k], tokens[2 + 2 * k]
        if op == "insert":
            trie.insert(word)
        elif op == "erase":
            out.append(1 if trie.erase(word) else 0)
        elif op == "search":
            out.append(1 if trie.search(word) else 0)
        else:
            out.append(trie.count_prefix(word))
    print("\n".join(map(str, out)))


main()
