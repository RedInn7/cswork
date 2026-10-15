#include <iostream>
#include <string>
using namespace std;

// 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
class DynamicArray {
    // TODO: 定长存储 new int[capacity] 加长度和容量 / fixed-size storage plus length and capacity

public:
    void push(int x) {}  // TODO

    int pop() { return 0; }  // TODO

    int get(int i) { return 0; }  // TODO

    void set(int i, int x) {}  // TODO

    void insert(int i, int x) {}  // TODO

    int erase(int i) { return 0; }  // TODO

    int size() { return 0; }  // TODO

    int capacity() { return 0; }  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    DynamicArray arr;
    int q, i, x;
    string op;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "push") {
            cin >> x;
            arr.push(x);
        } else if (op == "pop") {
            cout << arr.pop() << '\n';
        } else if (op == "get") {
            cin >> i;
            cout << arr.get(i) << '\n';
        } else if (op == "set") {
            cin >> i >> x;
            arr.set(i, x);
        } else if (op == "insert") {
            cin >> i >> x;
            arr.insert(i, x);
        } else if (op == "erase") {
            cin >> i;
            cout << arr.erase(i) << '\n';
        } else if (op == "size") {
            cout << arr.size() << '\n';
        } else {
            cout << arr.capacity() << '\n';
        }
    }
}
