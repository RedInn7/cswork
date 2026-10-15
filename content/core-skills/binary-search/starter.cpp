#include <iostream>
#include <vector>
using namespace std;

// 第一个 >= x 的下标 / First index with a[i] >= x, or a.size().
int lower_bound_index(const vector<int>& a, int x) {
    return 0;  // TODO
}

// 第一个 > x 的下标 / First index with a[i] > x, or a.size().
int upper_bound_index(const vector<int>& a, int x) {
    return 0;  // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, q, x;
    cin >> n >> q;
    vector<int> a(n);
    for (int& v : a) cin >> v;
    while (q--) {
        cin >> x;
        cout << lower_bound_index(a, x) << ' ' << upper_bound_index(a, x) << '\n';
    }
}
