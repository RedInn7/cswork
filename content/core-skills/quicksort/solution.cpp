#include <iostream>
#include <random>
#include <utility>
#include <vector>
using namespace std;

// Lomuto 划分 / Lomuto partition around a[hi]; returns the pivot's final index.
int partition(vector<int>& a, int lo, int hi) {
    int pivot = a[hi], i = lo;
    for (int j = lo; j < hi; j++)
        if (a[j] < pivot) swap(a[i++], a[j]);
    swap(a[i], a[hi]);
    return i;
}

mt19937 rng(20261022);

void sort_range(vector<int>& a, int lo, int hi) {
    while (lo < hi) {
        swap(a[uniform_int_distribution<int>(lo, hi)(rng)], a[hi]);
        int p = partition(a, lo, hi);
        // Recurse into the shorter side, loop on the longer: O(log n) deep.
        if (p - lo < hi - p) {
            sort_range(a, lo, p - 1);
            lo = p + 1;
        } else {
            sort_range(a, p + 1, hi);
            hi = p - 1;
        }
    }
}

// 原地升序排序 / Sort a in place: random pivots.
void quick_sort(vector<int>& a) { sort_range(a, 0, (int)a.size() - 1); }

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
