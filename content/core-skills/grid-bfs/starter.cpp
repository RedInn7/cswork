#include <iostream>
#include <queue>
#include <string>
#include <vector>
using namespace std;

// 网格 BFS / Fewest 4-directional steps from S to T, or -1.
int shortest_path(const vector<string>& grid) {
    return -1;  // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int rows, cols;
    cin >> rows >> cols;
    vector<string> grid(rows);
    for (string& row : grid) cin >> row;
    cout << shortest_path(grid) << '\n';
}
