#include <iostream>
#include <numeric>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 并查集 / Union-find over nodes 1..n with path halving and union by rank.
// union 是 C++ 关键字，所以合并叫 unite / union is a C++ keyword, so merging is unite.
class UnionFind {
    vector<int> parent;
    // TODO: 秩、集合大小、集合个数 / ranks, set sizes, number of sets

public:
    UnionFind(int n) : parent(n + 1) { iota(parent.begin(), parent.end(), 0); }

    int find(int x) { return x; }  // TODO

    bool unite(int a, int b) { return false; }  // TODO

    bool same(int a, int b) { return false; }  // TODO

    int size(int x) { return 1; }  // TODO

    int count() { return 0; }  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q, a, b;
    string op;
    cin >> n >> q;
    UnionFind uf(n);
    while (q--) {
        cin >> op;
        if (op == "union") {
            cin >> a >> b;
            cout << (uf.unite(a, b) ? 1 : 0) << '\n';
        } else if (op == "same") {
            cin >> a >> b;
            cout << (uf.same(a, b) ? 1 : 0) << '\n';
        } else if (op == "size") {
            cin >> a;
            cout << uf.size(a) << '\n';
        } else {
            cout << uf.count() << '\n';
        }
    }
}
