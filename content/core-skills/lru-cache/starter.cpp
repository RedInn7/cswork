#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

struct Node {
    int key, value;
    Node* prev = nullptr;
    Node* next = nullptr;
    Node(int key = 0, int value = 0) : key(key), value(value) {}
};

// LRU 缓存 / LRU cache: a hash map to the nodes of a doubly linked list, most recent first.
class LRUCache {
    int capacity;
    unordered_map<int, Node*> nodes;
    // TODO: 双向链表（建议用两个哨兵节点） / the doubly linked list (two sentinels help)

public:
    LRUCache(int capacity) : capacity(capacity) {}

    int get(int key) { return -1; }  // TODO

    int put(int key, int value) { return -1; }  // TODO: 返回被淘汰的键或 -1 / the evicted key, or -1

    vector<int> keys() { return {}; }  // TODO: 从最近到最久 / most recent first
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int capacity, q, k, v;
    string op;
    cin >> capacity >> q;
    LRUCache cache(capacity);
    while (q--) {
        cin >> op;
        if (op == "get") {
            cin >> k;
            cout << cache.get(k) << '\n';
        } else if (op == "put") {
            cin >> k >> v;
            cout << cache.put(k, v) << '\n';
        } else {
            vector<int> keys = cache.keys();
            if (keys.empty()) cout << "empty";
            for (size_t i = 0; i < keys.size(); i++) cout << (i ? " " : "") << keys[i];
            cout << '\n';
        }
    }
}
