#include <array>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 字典树 / Trie of lowercase words, counting repeated inserts.
class Trie {
    // TODO: 节点的 26 个孩子、pass 计数、end 计数 / each node's 26 children, pass count and end count

public:
    void insert(const string& word) {}  // TODO

    bool erase(const string& word) { return false; }  // TODO

    bool search(const string& word) { return false; }  // TODO

    int count_prefix(const string& p) { return 0; }  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int q;
    string op, word;
    cin >> q;
    Trie trie;
    while (q--) {
        cin >> op >> word;
        if (op == "insert") trie.insert(word);
        else if (op == "erase") cout << (trie.erase(word) ? 1 : 0) << '\n';
        else if (op == "search") cout << (trie.search(word) ? 1 : 0) << '\n';
        else cout << trie.count_prefix(word) << '\n';
    }
}
