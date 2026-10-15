#include <cstdint>
#include <iostream>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75.
class HashMap {
    vector<vector<pair<int, int>>> table = vector<vector<pair<int, int>>>(8);  // 每个桶一串 (key, value)
    int count = 0;

public:
    void put(int key, int value) {}  // TODO

    int get(int key) { return -1; }  // TODO

    bool remove(int key) { return false; }  // TODO

    int size() { return 0; }  // TODO

    int buckets() { return 0; }  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    HashMap table;
    int q, k, v;
    string op;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "put") {
            cin >> k >> v;
            table.put(k, v);
        } else if (op == "get") {
            cin >> k;
            cout << table.get(k) << '\n';
        } else if (op == "remove") {
            cin >> k;
            cout << (table.remove(k) ? 1 : 0) << '\n';
        } else if (op == "size") {
            cout << table.size() << '\n';
        } else {
            cout << table.buckets() << '\n';
        }
    }
}
