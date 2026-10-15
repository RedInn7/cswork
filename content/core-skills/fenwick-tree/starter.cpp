#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 树状数组 / Fenwick tree over indices 1..n: tree[i] sums (i - lowbit(i), i].
class FenwickTree {
    int n;
    vector<long long> tree;

public:
    FenwickTree(const vector<long long>& values) : n(values.size()), tree(values.size() + 1, 0) {
        // TODO: 建树 / build
    }

    void add(int i, long long x) {}  // TODO

    long long prefix(int i) { return 0; }  // TODO

    int kth(long long k) { return -1; }  // TODO: 倍增 / binary lifting
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    cin >> n >> q;
    vector<long long> values(n);
    for (long long& v : values) cin >> v;
    FenwickTree tree(values);
    string op;
    long long a, b;
    while (q--) {
        cin >> op >> a;
        if (op == "add") {
            cin >> b;
            tree.add(a, b);
        } else if (op == "prefix") {
            cout << tree.prefix(a) << '\n';
        } else {
            cout << tree.kth(a) << '\n';
        }
    }
}
