#include <iostream>
#include <set>
#include <string>
using namespace std;

// 电梯 / Elevator: one car.
// 建议用两个有序集合 / Suggested: two std::set<int>, upStops（上行时停 / stop while going up）
// and downStops（下行时停 / stop while going down）. 方向 / directions: "UP", "DOWN", "IDLE".
class Elevator {
public:
    Elevator(int floors, int start) {}  // TODO

    string call(int f, const string& want) { return ""; }  // TODO: 厅外按钮 / a hall call ("UP" / "DOWN"): "OK"

    string press(int f) { return ""; }  // TODO: 轿厢内按钮 / a car button: "OK", or "OPEN" at this floor

    string step() { return ""; }  // TODO: "<floor> <dir> OPEN" or "<floor> <dir> -"

    string where() { return ""; }  // TODO: "<floor> <dir> <pending stops>"
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int floors, start, q, f;
    string op, want;
    cin >> floors >> start >> q;
    Elevator car(floors, start);
    while (q--) {
        cin >> op;
        if (op == "call") {
            cin >> f >> want;
            cout << car.call(f, want == "U" ? "UP" : "DOWN") << '\n';
        } else if (op == "press") {
            cin >> f;
            cout << car.press(f) << '\n';
        } else if (op == "step") {
            cout << car.step() << '\n';
        } else {
            cout << car.where() << '\n';
        }
    }
}
