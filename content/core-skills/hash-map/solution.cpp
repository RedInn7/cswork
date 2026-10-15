#include <cstdint>
#include <iostream>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 哈希表 / Hash map with separate chaining: 8 buckets, doubled past load factor 0.75.
class HashMap {
    vector<vector<pair<int, int>>> table = vector<vector<pair<int, int>>>(8);
    int count = 0;

    // Multiplicative hashing spreads keys that share low bits.
    static size_t index(int key, size_t buckets) { return (uint32_t)key * 2654435761u % buckets; }

public:
    void put(int key, int value) {
        auto& bucket = table[index(key, table.size())];
        for (auto& [k, v] : bucket)
            if (k == key) {
                v = value;
                return;
            }
        bucket.push_back({key, value});
        if (++count * 4 > (int)table.size() * 3) {
            vector<vector<pair<int, int>>> next(2 * table.size());
            for (auto& chain : table)
                for (auto& entry : chain) next[index(entry.first, next.size())].push_back(entry);
            table.swap(next);
        }
    }

    int get(int key) {
        for (auto& [k, v] : table[index(key, table.size())])
            if (k == key) return v;
        return -1;
    }

    bool remove(int key) {
        auto& bucket = table[index(key, table.size())];
        for (auto& entry : bucket)
            if (entry.first == key) {
                entry = bucket.back();
                bucket.pop_back();
                count--;
                return true;
            }
        return false;
    }

    int size() { return count; }

    int buckets() { return table.size(); }
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
