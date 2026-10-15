#include <climits>
#include <iostream>
#include <vector>
using namespace std;

// O(n²) Prim / Nodes (0-based) in the order they join the tree from node 0; fewer than n if disconnected.
vector<int> prim(int n, const vector<vector<int>>& w) {
    return {};  // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<vector<int>> w(n, vector<int>(n));
    for (auto& row : w)
        for (int& x : row) cin >> x;
    vector<int> order = prim(n, w);
    if ((int)order.size() != n) {
        cout << -1 << '\n';
        return 0;
    }
    // Each node joined through its lightest edge to the nodes before it.
    long long total = 0;
    for (int k = 1; k < n; k++) {
        int best = INT_MAX;
        for (int j = 0; j < k; j++)
            if (w[order[j]][order[k]] > 0 && w[order[j]][order[k]] < best) best = w[order[j]][order[k]];
        total += best;
    }
    cout << total << '\n';
    for (int k = 0; k < n; k++) cout << order[k] + 1 << (k + 1 < n ? ' ' : '\n');
}
