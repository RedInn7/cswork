#include <iostream>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 最小堆 / Binary min-heap on an array: parent (i - 1) / 2, children 2i + 1 and 2i + 2.
class MinHeap {
    vector<int> a;

    void sift_up(int i) {
        while (i > 0 && a[i] < a[(i - 1) / 2]) {
            swap(a[i], a[(i - 1) / 2]);
            i = (i - 1) / 2;
        }
    }

    void sift_down(int i) {
        int n = a.size();
        while (2 * i + 1 < n) {
            int c = 2 * i + 1;
            if (c + 1 < n && a[c + 1] < a[c]) c++;
            if (!(a[c] < a[i])) break;
            swap(a[i], a[c]);
            i = c;
        }
    }

public:
    void push(int x) {
        a.push_back(x);
        sift_up(a.size() - 1);
    }

    int pop() {
        int top = a[0];
        a[0] = a.back();
        a.pop_back();
        if (!a.empty()) sift_down(0);
        return top;
    }

    int top() { return a[0]; }

    int size() { return a.size(); }

    void build(const vector<int>& values) {
        a = values;
        for (int i = (int)a.size() / 2 - 1; i >= 0; i--) sift_down(i);
    }

    vector<int> dump() { return a; }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    MinHeap heap;
    int q, x;
    string op;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "push") {
            cin >> x;
            heap.push(x);
        } else if (op == "build") {
            cin >> x;
            vector<int> values(x);
            for (int& v : values) cin >> v;
            heap.build(values);
        } else if (op == "size") {
            cout << heap.size() << '\n';
        } else if (op == "dump") {
            vector<int> v = heap.dump();
            if (v.empty()) cout << "empty";
            for (size_t k = 0; k < v.size(); k++) cout << (k ? " " : "") << v[k];
            cout << '\n';
        } else if (heap.size() == 0) {
            cout << "empty\n";
        } else if (op == "pop") {
            cout << heap.pop() << '\n';
        } else {
            cout << heap.top() << '\n';
        }
    }
}
