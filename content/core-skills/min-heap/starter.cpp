#include <iostream>
#include <string>
#include <utility>
#include <vector>
using namespace std;

// 最小堆 / Binary min-heap on an array: parent (i - 1) / 2, children 2i + 1 and 2i + 2.
class MinHeap {
    vector<int> a;

public:
    void push(int x) {}  // TODO: 放到末尾后上浮 / append, then sift up

    int pop() { return 0; }  // TODO: 末尾移到堆顶后下沉 / move the last to the top, then sift down

    int top() { return 0; }  // TODO

    int size() { return 0; }  // TODO

    void build(const vector<int>& values) {}  // TODO: Floyd 建堆 / Floyd's construction

    vector<int> dump() { return {}; }  // TODO
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
