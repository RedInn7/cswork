#include <iostream>
#include <string>
using namespace std;

// 双端队列 / Deque on a ring buffer: element i lives at data[(head + i) % capacity].
class RingDeque {
    int* data = new int[4];
    int capacity = 4, head = 0, length = 0;

    void grow() {
        int* next = new int[2 * capacity];
        for (int i = 0; i < length; i++) next[i] = data[(head + i) % capacity];
        delete[] data;
        data = next;
        capacity *= 2;
        head = 0;
    }

public:
    ~RingDeque() { delete[] data; }

    void push_front(int x) {
        if (length == capacity) grow();
        head = (head - 1 + capacity) % capacity;
        data[head] = x;
        length++;
    }

    void push_back(int x) {
        if (length == capacity) grow();
        data[(head + length) % capacity] = x;
        length++;
    }

    int pop_front() {
        int x = data[head];
        head = (head + 1) % capacity;
        length--;
        return x;
    }

    int pop_back() {
        int x = back();
        length--;
        return x;
    }

    int front() { return data[head]; }

    int back() { return get(length - 1); }

    int get(int i) { return data[(head + i) % capacity]; }

    int size() { return length; }
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
