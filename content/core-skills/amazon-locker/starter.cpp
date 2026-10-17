#include <cstdio>
#include <deque>
#include <iostream>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

// 快递柜 / Locker station.
// 建议拆出 / Suggested: CodeGenerator（题面里的 LCG / the statement's LCG）, Parcel（包裹、格口、截止时刻 /
// package, compartment, deadline）; 每种尺寸一个空格口堆 / a free-compartment heap per size;
// 取件码 -> 包裹的哈希表 / a hash map from code to parcel. 尺寸 size: 0 = S, 1 = M, 2 = L.
class LockerStation {
public:
    LockerStation(const vector<int>& counts, long long keep, long long seed) {}  // TODO

    string deliver(long long t, const string& pkg, int size) { return ""; }  // TODO: "<compartment> <code>" or "FULL"

    string pickup(long long t, const string& code) { return ""; }  // TODO: "<pkg> <compartment>", "INVALID", "LOCKED"

    string returns(long long t) { return ""; }  // TODO: 待退回的包裹 / packages to return, or "NONE"

    int free(long long t, int size) { return 0; }  // TODO: 该尺寸的空格口数 / free compartments of exactly that size
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    vector<int> counts(3);
    for (int& c : counts) cin >> c;
    long long keep, seed, t;
    int q;
    cin >> keep >> seed >> q;
    LockerStation station(counts, keep, seed);
    auto sizeOf = [](const string& s) { return s == "S" ? 0 : s == "M" ? 1 : 2; };
    string op, pkg, size, code;
    while (q--) {
        cin >> op >> t;
        if (op == "deliver") {
            cin >> pkg >> size;
            cout << station.deliver(t, pkg, sizeOf(size)) << '\n';
        } else if (op == "pickup") {
            cin >> code;
            cout << station.pickup(t, code) << '\n';
        } else if (op == "returns") {
            cout << station.returns(t) << '\n';
        } else {
            cin >> size;
            cout << station.free(t, sizeOf(size)) << '\n';
        }
    }
}
