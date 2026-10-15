#include <iostream>
#include <vector>
using namespace std;

// 归并排序 / Sort a in place and return its inversion count.
long long merge_sort(vector<int>& a) {
    return 0;  // TODO
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
