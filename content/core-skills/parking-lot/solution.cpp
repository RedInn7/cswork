#include <iostream>
#include <queue>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

// 每种尺寸一个空位小根堆 / one min-heap of free spot ids per size.
class SpotAllocator {
    vector<priority_queue<int, vector<int>, greater<int>>> free_;

public:
    vector<int> sizeOf;  // spot id - 1 -> size

    SpotAllocator(const vector<int>& counts) : free_(3) {
        int id = 1;
        for (int size = 0; size < 3; size++)
            for (int k = 0; k < counts[size]; k++, id++) {
                free_[size].push(id);
                sizeOf.push_back(size);
            }
    }

    int allocate(int need) {  // 先试刚好合适的尺寸 / smallest size that fits first; -1: none
        for (int size = need; size < 3; size++)
            if (!free_[size].empty()) {
                int spot = free_[size].top();
                free_[size].pop();
                return spot;
            }
        return -1;
    }

    void release(int spot) { free_[sizeOf[spot - 1]].push(spot); }

    int freeCount(int size) const { return free_[size].size(); }
};

struct Ticket {
    string plate;
    int spot;
    long long entry;
};

class HourlyPricing {
    vector<long long> rates;

public:
    HourlyPricing(const vector<int>& rates) : rates(rates.begin(), rates.end()) {}

    long long fee(int size, long long minutes) const { return max(1LL, (minutes + 59) / 60) * rates[size]; }
};

// 停车场 / Parking lot: tickets by id, plates parked, a spot allocator and a pricing rule.
class ParkingLot {
    SpotAllocator allocator;
    HourlyPricing pricing;
    unordered_map<long long, Ticket> active;  // ticket id -> ticket
    unordered_set<string> parked;
    long long nextId = 1;

public:
    ParkingLot(const vector<int>& counts, const vector<int>& rates) : allocator(counts), pricing(rates) {}

    string park(const string& plate, int size, long long t) {
        if (parked.count(plate)) return "DUPLICATE";
        int spot = allocator.allocate(size);
        if (spot < 0) return "FULL";
        long long id = nextId++;
        active[id] = {plate, spot, t};
        parked.insert(plate);
        return to_string(id) + " " + to_string(spot);
    }

    string unpark(long long ticketId, long long t) {
        auto it = active.find(ticketId);
        if (it == active.end()) return "INVALID";
        Ticket ticket = it->second;
        active.erase(it);  // 取出即作废 / used once
        parked.erase(ticket.plate);
        allocator.release(ticket.spot);
        return to_string(pricing.fee(allocator.sizeOf[ticket.spot - 1], t - ticket.entry));
    }

    int available(int size) { return allocator.freeCount(size); }
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
