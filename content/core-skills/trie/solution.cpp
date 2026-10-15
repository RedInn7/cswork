#include <array>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 字典树 / Trie of lowercase words, counting repeated inserts. Node 0 is the root; child 0 means none.
class Trie {
    vector<array<int, 26>> next = {array<int, 26>{}};
    vector<int> pass = {0}, end = {0};  // 经过 / 结束于该节点的单词数 / words through / ending at a node

    int walk(const string& word) {
        int node = 0;
        for (char ch : word)
            if (!(node = next[node][ch - 'a'])) return -1;
        return node;
    }

public:
    void insert(const string& word) {
        int node = 0;
        pass[0]++;
        for (char ch : word) {
            int c = ch - 'a';
            if (!next[node][c]) {
                next[node][c] = next.size();
                next.push_back({});
                pass.push_back(0);
                end.push_back(0);
            }
            node = next[node][c];
            pass[node]++;
        }
        end[node]++;
    }

    bool erase(const string& word) {
        if (!search(word)) return false;
        int node = 0;
        pass[0]--;
        for (char ch : word) {
            node = next[node][ch - 'a'];
            pass[node]--;
        }
        end[node]--;
        return true;
    }

    bool search(const string& word) {
        int node = walk(word);
        return node >= 0 && end[node] > 0;
    }

    int count_prefix(const string& p) {
        int node = walk(p);
        return node < 0 ? 0 : pass[node];
    }
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
