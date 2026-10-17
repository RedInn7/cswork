#include <iostream>
#include <set>
#include <string>
using namespace std;

// 电梯 / Elevator: one car, LOOK scheduling over two sets of stops.
class Elevator {
    int floor;
    string dir = "IDLE";
    set<int> upStops;    // 上行时要停的楼层 / floors to stop at while going up
    set<int> downStops;  // 下行时要停的楼层 / floors to stop at while going down

    bool workAbove() const { return upStops.upper_bound(floor) != upStops.end() || downStops.upper_bound(floor) != downStops.end(); }
    bool workBelow() const {
        return (!upStops.empty() && *upStops.begin() < floor) || (!downStops.empty() && *downStops.begin() < floor);
    }

public:
    Elevator(int floors, int start) : floor(start) {}

    string call(int f, const string& want) {
        (want == "UP" ? upStops : downStops).insert(f);
        return "OK";
    }

    string press(int f) {
        if (f > floor) upStops.insert(f);
        else if (f < floor) downStops.insert(f);
        else return "OPEN";
        return "OK";
    }

    string step() {
        if (dir == "UP" && !workAbove()) dir = workBelow() ? "DOWN" : "IDLE";
        else if (dir == "DOWN" && !workBelow()) dir = workAbove() ? "UP" : "IDLE";
        else if (dir == "IDLE") dir = workAbove() ? "UP" : workBelow() ? "DOWN" : "IDLE";
        bool stop;
        if (dir == "IDLE") {  // 别处没有任务：服务本层 / nothing elsewhere: serve this floor
            stop = upStops.erase(floor) | downStops.erase(floor);
        } else if ((dir == "UP" ? upStops : downStops).erase(floor)) {
            stop = true;  // 本层有同方向的请求：开门，这一步不动 / a call here this way: open, stay
        } else if (dir == "UP") {
            floor++;
            stop = upStops.erase(floor);
            if (!workAbove()) stop |= downStops.erase(floor) > 0;  // 本趟的最高点 / top of the sweep
        } else {
            floor--;
            stop = downStops.erase(floor);
            if (!workBelow()) stop |= upStops.erase(floor) > 0;
        }
        return to_string(floor) + " " + dir + (stop ? " OPEN" : " -");
    }

    string where() { return to_string(floor) + " " + dir + " " + to_string(upStops.size() + downStops.size()); }
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
