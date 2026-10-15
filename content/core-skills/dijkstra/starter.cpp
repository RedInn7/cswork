#include <functional>
#include <iostream>
#include <queue>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

// Dijkstra / Shortest distances from s to nodes 1..n on non-negative weights; -1 if unreachable.
vector<long long> dijkstra(int n, const vector<tuple<int, int, int>>& edges, int s) {
    return vector<long long>(n, -1);  // TODO
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
