#include <iostream>
#include <string>
using namespace std;

// 动态数组 / Dynamic array: capacity starts at 1, doubles when full, halves at a quarter.
class DynamicArray {
    int* data_ = new int[1];
    int size_ = 0, capacity_ = 1;

    void resize(int capacity) {
        int* data = new int[capacity];
        for (int i = 0; i < size_; i++) data[i] = data_[i];
        delete[] data_;
        data_ = data;
        capacity_ = capacity;
    }

public:
    ~DynamicArray() { delete[] data_; }

    void push(int x) { insert(size_, x); }

    int pop() { return erase(size_ - 1); }

    int get(int i) { return data_[i]; }

    void set(int i, int x) { data_[i] = x; }

    void insert(int i, int x) {
        if (size_ == capacity_) resize(2 * capacity_);
        for (int j = size_; j > i; j--) data_[j] = data_[j - 1];
        data_[i] = x;
        size_++;
    }

    int erase(int i) {
        int x = data_[i];
        for (int j = i; j + 1 < size_; j++) data_[j] = data_[j + 1];
        size_--;
        if (capacity_ > 1 && size_ * 4 <= capacity_) resize(capacity_ / 2);
        return x;
    }

    int size() { return size_; }

    int capacity() { return capacity_; }
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
