#include <iostream>
#include <queue>
#include <string>
#include <vector>
using namespace std;

// 网格 BFS / Fewest 4-directional steps from S to T, or -1.
int shortest_path(const vector<string>& grid) {
    int rows = grid.size(), cols = grid[0].size();
    vector<int> dist(rows * cols, -1);
    queue<int> q;
    for (int r = 0; r < rows; r++)
        for (int c = 0; c < cols; c++)
            if (grid[r][c] == 'S') {
                dist[r * cols + c] = 0;
                q.push(r * cols + c);
            }
    const int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    while (!q.empty()) {
        int r = q.front() / cols, c = q.front() % cols;
        q.pop();
        if (grid[r][c] == 'T') return dist[r * cols + c];
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] == '#' || dist[nr * cols + nc] >= 0)
                continue;
            dist[nr * cols + nc] = dist[r * cols + c] + 1;
            q.push(nr * cols + nc);
        }
    }
    return -1;
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
