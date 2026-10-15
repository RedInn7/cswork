#include <iostream>
#include <random>
#include <utility>
#include <vector>
using namespace std;

// Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index.
int partition(vector<int>& a, int lo, int hi) {
    return lo;  // TODO
}

// 原地升序排序 / Sort a in place.
void quick_sort(vector<int>& a) {
    // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<int> a(n);
    for (int& v : a) cin >> v;
    vector<int> b = a;
    int p = partition(b, 0, n - 1);
    quick_sort(a);
    cout << p << '\n';
    for (int i = 0; i < n; i++) cout << b[i] << (i + 1 < n ? ' ' : '\n');
    for (int i = 0; i < n; i++) cout << a[i] << (i + 1 < n ? ' ' : '\n');
}
