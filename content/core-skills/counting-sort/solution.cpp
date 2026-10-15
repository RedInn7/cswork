#include <iostream>
#include <vector>
using namespace std;

// 稳定计数排序 / Stable counting sort: record indices ordered by key, ties in input order.
vector<int> counting_sort(const vector<int>& keys, int k) {
    vector<int> start(k + 1, 0);
    for (int key : keys) start[key + 1]++;
    for (int v = 0; v < k; v++) start[v + 1] += start[v];
    vector<int> order(keys.size());
    for (int i = 0; i < (int)keys.size(); i++) order[start[keys[i]]++] = i;
    return order;
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, k;
    cin >> n >> k;
    vector<int> keys(n);
    for (int& v : keys) cin >> v;
    vector<int> order = counting_sort(keys, k);
    for (int i = 0; i < n; i++) cout << order[i] + 1 << (i + 1 < n ? ' ' : '\n');
}
