#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 线段树 / Iterative segment tree of sums: leaves at n..2n-1, node k's parent at k / 2.
class SegmentTree {
    int n;
    vector<long long> tree;

public:
    SegmentTree(const vector<long long>& values) : n(values.size()), tree(2 * values.size()) {
        for (int i = 0; i < n; i++) tree[n + i] = values[i];
        for (int k = n - 1; k > 0; k--) tree[k] = tree[2 * k] + tree[2 * k + 1];
    }

    void update(int i, long long x) {
        int k = i + n;
        tree[k] = x;
        for (k /= 2; k >= 1; k /= 2) tree[k] = tree[2 * k] + tree[2 * k + 1];
    }

    long long query(int l, int r) {
        long long total = 0;
        for (l += n, r += n + 1; l < r; l /= 2, r /= 2) {
            if (l & 1) total += tree[l++];
            if (r & 1) total += tree[--r];
        }
        return total;
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q;
    cin >> n >> q;
    vector<long long> values(n);
    for (long long& v : values) cin >> v;
    SegmentTree tree(values);
    string op;
    long long a, b;
    while (q--) {
        cin >> op >> a >> b;
        if (op == "set") tree.update(a - 1, b);
        else cout << tree.query(a - 1, b - 1) << '\n';
    }
}
