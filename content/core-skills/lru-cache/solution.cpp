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
    Node head, tail;  // sentinels

    static void unlink(Node* node) {
        node->prev->next = node->next;
        node->next->prev = node->prev;
    }

    void push_front(Node* node) {
        node->prev = &head;
        node->next = head.next;
        head.next->prev = node;
        head.next = node;
    }

public:
    LRUCache(int capacity) : capacity(capacity) {
        head.next = &tail;
        tail.prev = &head;
    }

    int get(int key) {
        auto it = nodes.find(key);
        if (it == nodes.end()) return -1;
        unlink(it->second);
        push_front(it->second);
        return it->second->value;
    }

    int put(int key, int value) {
        auto it = nodes.find(key);
        if (it != nodes.end()) {
            it->second->value = value;
            unlink(it->second);
            push_front(it->second);
            return -1;
        }
        Node* node = nodes[key] = new Node(key, value);
        push_front(node);
        if ((int)nodes.size() <= capacity) return -1;
        Node* oldest = tail.prev;
        unlink(oldest);
        nodes.erase(oldest->key);
        int evicted = oldest->key;
        delete oldest;
        return evicted;
    }

    vector<int> keys() {
        vector<int> out;
        for (Node* node = head.next; node != &tail; node = node->next) out.push_back(node->key);
        return out;
    }
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
