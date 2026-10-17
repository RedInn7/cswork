#include <iostream>
#include <queue>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

// 停车场 / Parking lot.
// 建议拆出 / Suggested classes: SpotAllocator（每种尺寸一个空位堆 / a free-spot heap per size）,
// Ticket, HourlyPricing（计费策略 / the pricing strategy）. 尺寸 size: 0 = S, 1 = M, 2 = L.
class ParkingLot {
public:
    // counts[size]: 该尺寸车位数 / spots of that size; rates[size]: 每小时价格 / price per hour
    ParkingLot(const vector<int>& counts, const vector<int>& rates) {}  // TODO

    string park(const string& plate, int size, long long t) { return ""; }  // TODO: "<ticket> <spot>", "FULL", "DUPLICATE"

    string unpark(long long ticketId, long long t) { return ""; }  // TODO: 停车费 / the fee, or "INVALID"

    int available(int size) { return 0; }  // TODO: 该尺寸的空位数 / free spots of exactly that size
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    vector<int> counts(3), rates(3);
    for (int& c : counts) cin >> c;
    for (int& r : rates) cin >> r;
    ParkingLot lot(counts, rates);
    auto sizeOf = [](const string& s) { return s == "S" ? 0 : s == "M" ? 1 : 2; };
    int q;
    cin >> q;
    string op, plate, size;
    long long ticket, t;
    while (q--) {
        cin >> op;
        if (op == "park") {
            cin >> plate >> size >> t;
            cout << lot.park(plate, sizeOf(size), t) << '\n';
        } else if (op == "unpark") {
            cin >> ticket >> t;
            cout << lot.unpark(ticket, t) << '\n';
        } else {
            cin >> size;
            cout << lot.available(sizeOf(size)) << '\n';
        }
    }
}
