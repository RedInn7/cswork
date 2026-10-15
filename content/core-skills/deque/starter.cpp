#include <iostream>
#include <string>
using namespace std;

// 双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity].
class RingDeque {
    int* data = new int[4];
    int capacity = 4, head = 0, length = 0;

public:
    void push_front(int x) {}  // TODO

    void push_back(int x) {}  // TODO

    int pop_front() { return 0; }  // TODO

    int pop_back() { return 0; }  // TODO

    int front() { return 0; }  // TODO

    int back() { return 0; }  // TODO

    int get(int i) { return 0; }  // TODO

    int size() { return 0; }  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    RingDeque dq;
    int q, x;
    string op;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "push_front") {
            cin >> x;
            dq.push_front(x);
        } else if (op == "push_back") {
            cin >> x;
            dq.push_back(x);
        } else if (op == "get") {
            cin >> x;
            cout << dq.get(x) << '\n';
        } else if (op == "size") {
            cout << dq.size() << '\n';
        } else if (dq.size() == 0) {
            cout << "empty\n";
        } else if (op == "pop_front") {
            cout << dq.pop_front() << '\n';
        } else if (op == "pop_back") {
            cout << dq.pop_back() << '\n';
        } else if (op == "front") {
            cout << dq.front() << '\n';
        } else {
            cout << dq.back() << '\n';
        }
    }
}
