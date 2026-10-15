#include <functional>
#include <iostream>
#include <queue>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

// Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
vector<long long> dijkstra(int n, const vector<tuple<int, int, int>>& edges, int s) {
    vector<vector<pair<int, int>>> adj(n + 1);
    for (auto [u, v, w] : edges) adj[u].push_back({v, w});
    vector<long long> dist(n + 1, -1);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> heap;
    dist[s] = 0;
    heap.push({0, s});
    while (!heap.empty()) {
        auto [d, u] = heap.top();
        heap.pop();
        if (d > dist[u]) continue;  // stale
        for (auto [v, w] : adj[u])
            if (dist[v] < 0 || d + w < dist[v]) {
                dist[v] = d + w;
                heap.push({dist[v], v});
            }
    }
    return vector<long long>(dist.begin() + 1, dist.end());
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m, s;
    cin >> n >> m >> s;
    vector<tuple<int, int, int>> edges(m);
    for (auto& [u, v, w] : edges) cin >> u >> v >> w;
    vector<long long> dist = dijkstra(n, edges, s);
    for (int i = 0; i < n; i++) cout << dist[i] << (i + 1 < n ? ' ' : '\n');
}
