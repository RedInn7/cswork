#include <iostream>
#include <tuple>
#include <vector>
using namespace std;

const long long INF = 1e18;  // 到不了 / unreachable

// Bellman-Ford / Distances from s to nodes 1..n (INF if unreachable), or {} if s reaches a negative cycle.
vector<long long> bellman_ford(int n, const vector<tuple<int, int, int>>& edges, int s) {
    vector<long long> dist(n + 1, INF);
    dist[s] = 0;
    for (int round = 1; round < n; round++) {
        bool changed = false;
        for (auto [u, v, w] : edges)
            if (dist[u] != INF && dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                changed = true;
            }
        if (!changed) break;
    }
    for (auto [u, v, w] : edges)
        if (dist[u] != INF && dist[u] + w < dist[v]) return {};
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
    vector<long long> dist = bellman_ford(n, edges, s);
    if (dist.empty()) {
        cout << "NEGATIVE CYCLE\n";
        return 0;
    }
    for (int i = 0; i < n; i++) {
        if (dist[i] == INF) cout << "INF";
        else cout << dist[i];
        cout << (i + 1 < n ? ' ' : '\n');
    }
}
