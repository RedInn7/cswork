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

    def _walk(self, word):
        node = self.root
        for ch in word:
            node = node.children[ord(ch) - 97]
            if node is None:
                return None
        return node

    def insert(self, word: str) -> None:
        node = self.root
        node.pass_count += 1
        for ch in word:
            c = ord(ch) - 97
            if node.children[c] is None:
                node.children[c] = Node()
            node = node.children[c]
            node.pass_count += 1
        node.end_count += 1

    def erase(self, word: str) -> bool:
        if not self.search(word):
            return False
        node = self.root
        node.pass_count -= 1
        for ch in word:
            node = node.children[ord(ch) - 97]
            node.pass_count -= 1
        node.end_count -= 1
        return True

    def search(self, word: str) -> bool:
        node = self._walk(word)
        return node is not None and node.end_count > 0

    def count_prefix(self, p: str) -> int:
        node = self._walk(p)
        return 0 if node is None else node.pass_count


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
