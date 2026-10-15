#include <iostream>
#include <vector>
using namespace std;

static long long sort_range(vector<int>& a, vector<int>& buf, int lo, int hi) {  // [lo, hi)
    if (hi - lo < 2) return 0;
    int mid = (lo + hi) / 2;
    long long count = sort_range(a, buf, lo, mid) + sort_range(a, buf, mid, hi);
    int i = lo, j = mid;
    for (int k = lo; k < hi; k++) {
        if (j >= hi || (i < mid && a[i] <= a[j])) buf[k] = a[i++];
        else {
            buf[k] = a[j++];
            count += mid - i;
        }
    }
    for (int k = lo; k < hi; k++) a[k] = buf[k];
    return count;
}

// 归并排序 / Sort a in place and return its inversion count.
long long merge_sort(vector<int>& a) {
    vector<int> buf(a.size());
    return sort_range(a, buf, 0, a.size());
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<int> a(n);
    for (int& v : a) cin >> v;
    cout << merge_sort(a) << '\n';
    for (int i = 0; i < n; i++) cout << a[i] << (i + 1 < n ? ' ' : '\n');
}
