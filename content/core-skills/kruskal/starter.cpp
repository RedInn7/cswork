#include <algorithm>
#include <iostream>
#include <numeric>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

// Kruskal / Indices of the chosen edges in the order chosen; fewer than n - 1 if disconnected.
vector<int> kruskal(int n, const vector<tuple<int, int, int>>& edges) {
    return {};  // TODO: 排序 + 并查集 / sort + union-find
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<tuple<int, int, int>> edges(m);
    for (auto& [u, v, w] : edges) cin >> u >> v >> w;
    vector<int> chosen = kruskal(n, edges);
    if ((int)chosen.size() != n - 1) {
        cout << -1 << '\n';
        return 0;
    }
    long long total = 0;
    for (int i : chosen) total += get<2>(edges[i]);
    cout << total << '\n';
    for (size_t k = 0; k < chosen.size(); k++) cout << (k ? " " : "") << chosen[k] + 1;
    cout << '\n';
}
