#include <iostream>
#include <string>
#include <vector>
using namespace std;

struct Node {
    int val;
    Node* next;
    Node(int val, Node* next = nullptr) : val(val), next(next) {}
};

// 单链表 / Singly linked list with head and tail pointers.
class LinkedList {
    Node* head = nullptr;
    Node* tail = nullptr;
    int length = 0;

public:
    void push_front(int x) {
        head = new Node(x, head);
        if (!tail) tail = head;
        length++;
    }

    void push_back(int x) {
        Node* node = new Node(x);
        if (tail) tail->next = node;
        else head = node;
        tail = node;
        length++;
    }

    int pop_front() {
        Node* node = head;
        head = node->next;
        if (!head) tail = nullptr;
        length--;
        int val = node->val;
        delete node;
        return val;
    }

    void insert(int i, int x) {
        if (i == 0) return push_front(x);
        if (i == length) return push_back(x);
        Node* prev = head;
        for (int k = 0; k < i - 1; k++) prev = prev->next;
        prev->next = new Node(x, prev->next);
        length++;
    }

    bool remove(int x) {
        Node* prev = nullptr;
        Node* node = head;
        while (node && node->val != x) prev = node, node = node->next;
        if (!node) return false;
        if (prev) prev->next = node->next;
        else head = node->next;
        if (node == tail) tail = prev;
        length--;
        delete node;
        return true;
    }

    void reverse() {
        Node* prev = nullptr;
        Node* node = head;
        tail = head;
        while (node) {
            Node* next = node->next;
            node->next = prev;
            prev = node;
            node = next;
        }
        head = prev;
    }

    int size() { return length; }

    vector<int> values() {
        vector<int> out;
        for (Node* node = head; node; node = node->next) out.push_back(node->val);
        return out;
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    LinkedList lst;
    int q, i, x;
    string op;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "push_front") {
            cin >> x;
            lst.push_front(x);
        } else if (op == "push_back") {
            cin >> x;
            lst.push_back(x);
        } else if (op == "pop_front") {
            cout << lst.pop_front() << '\n';
        } else if (op == "insert") {
            cin >> i >> x;
            lst.insert(i, x);
        } else if (op == "remove") {
            cin >> x;
            cout << (lst.remove(x) ? 1 : 0) << '\n';
        } else if (op == "reverse") {
            lst.reverse();
        } else if (op == "size") {
            cout << lst.size() << '\n';
        } else {
            vector<int> v = lst.values();
            if (v.empty()) cout << "empty";
            for (size_t k = 0; k < v.size(); k++) cout << (k ? " " : "") << v[k];
            cout << '\n';
        }
    }
}
