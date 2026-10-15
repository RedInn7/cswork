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
        for (int i = 1; i <= n; i++) tree[i] = values[i - 1];
        for (int i = 1; i <= n; i++)  // O(n) build
            if (int j = i + (i & -i); j <= n) tree[j] += tree[i];
    }

    void add(int i, long long x) {
        for (; i <= n; i += i & -i) tree[i] += x;
    }

    long long prefix(int i) {
        long long total = 0;
        for (; i > 0; i -= i & -i) total += tree[i];
        return total;
    }

    int kth(long long k) {
        if (prefix(n) < k) return -1;
        int pos = 0, step = 1;
        while (step * 2 <= n) step *= 2;
        for (; step; step /= 2)
            if (pos + step <= n && tree[pos + step] < k) {
                pos += step;
                k -= tree[pos];
            }
        return pos + 1;
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
