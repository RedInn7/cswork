#include <functional>
#include <iostream>
#include <queue>
#include <utility>
#include <vector>
using namespace std;

// Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or {} on a cycle.
vector<int> topo_order(int n, const vector<pair<int, int>>& edges) {
    return {};  // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<pair<int, int>> edges(m);
    for (auto& [u, v] : edges) cin >> u >> v;
    vector<int> order = topo_order(n, edges);
    if (order.empty()) cout << -1;
    for (size_t i = 0; i < order.size(); i++) cout << (i ? " " : "") << order[i];
    cout << '\n';
}
