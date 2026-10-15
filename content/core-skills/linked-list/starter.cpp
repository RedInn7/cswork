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
    void push_front(int x) {}  // TODO

    void push_back(int x) {}  // TODO

    int pop_front() { return 0; }  // TODO

    void insert(int i, int x) {}  // TODO

    bool remove(int x) { return false; }  // TODO

    void reverse() {}  // TODO

    int size() { return 0; }  // TODO

    vector<int> values() { return {}; }  // TODO: 从 head 走到尾 / walk from head to the end
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
