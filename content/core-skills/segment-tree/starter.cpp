#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 线段树 / Segment tree of range sums with point updates.
class SegmentTree {
    // TODO

public:
    SegmentTree(const vector<long long>& values) {}  // TODO

    void update(int i, long long x) {}  // TODO

    long long query(int l, int r) { return 0; }  // TODO
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
