#include <iostream>
#include <numeric>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 并查集 / Union-find over nodes 1..n with path halving and union by rank.
class UnionFind {
    vector<int> parent, rank_, sizes;
    int sets;

public:
    UnionFind(int n) : parent(n + 1), rank_(n + 1, 0), sizes(n + 1, 1), sets(n) {
        iota(parent.begin(), parent.end(), 0);
    }

    int find(int x) {
        while (parent[x] != x) x = parent[x] = parent[parent[x]];
        return x;
    }

    bool unite(int a, int b) {
        a = find(a), b = find(b);
        if (a == b) return false;
        if (rank_[a] < rank_[b]) swap(a, b);
        parent[b] = a;
        sizes[a] += sizes[b];
        if (rank_[a] == rank_[b]) rank_[a]++;
        sets--;
        return true;
    }

    bool same(int a, int b) { return find(a) == find(b); }

    int size(int x) { return sizes[find(x)]; }

    int count() { return sets; }
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
