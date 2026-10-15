#include <functional>
#include <iostream>
#include <queue>
#include <utility>
#include <vector>
using namespace std;

// Kahn 算法 / Kahn's algorithm with a min-heap: the smallest order, or {} on a cycle.
vector<int> topo_order(int n, const vector<pair<int, int>>& edges) {
    vector<vector<int>> out_edges(n + 1);
    vector<int> indegree(n + 1, 0), order;
    for (auto [u, v] : edges) {
        out_edges[u].push_back(v);
        indegree[v]++;
    }
    priority_queue<int, vector<int>, greater<int>> ready;
    for (int v = 1; v <= n; v++)
        if (indegree[v] == 0) ready.push(v);
    while (!ready.empty()) {
        int u = ready.top();
        ready.pop();
        order.push_back(u);
        for (int v : out_edges[u])
            if (--indegree[v] == 0) ready.push(v);
    }
    if ((int)order.size() < n) order.clear();
    return order;
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
