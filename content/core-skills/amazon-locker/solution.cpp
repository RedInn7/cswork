#include <cstdio>
#include <deque>
#include <iostream>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

const int MAX_FAILURES = 5, LOCKOUT = 30;

// 取件码生成器 / Pickup codes from a fixed LCG, so the judge can replay them (production: a CSPRNG).
class CodeGenerator {
    long long x;

public:
    CodeGenerator(long long seed) : x(seed) {}

    string next() {
        x = (x * 1103515245 + 12345) % 2147483648LL;
        char code[8];
        snprintf(code, sizeof code, "%06lld", x % 1000000);
        return code;
    }
};

struct Parcel {
    string pkg;
    int compartment;
    long long deadline;
};

// 快递柜 / Locker station: free compartments by size, parcels by code, expiry and a keypad lockout.
class LockerStation {
    long long keep;
    CodeGenerator codes;
    vector<priority_queue<int, vector<int>, greater<int>>> freeBySize;
    vector<int> sizeOf;  // compartment - 1 -> size
    vector<Parcel> parcels;
    unordered_map<string, int> byCode;  // 有效的取件码 -> 包裹下标 / active code -> parcel index
    deque<pair<string, int>> queue;     // (code, parcel) 按投递顺序 / in delivery order: also expiry order
    vector<string> returned;            // 超期待退回 / expired, waiting for the returns courier
    int failures = 0;
    long long lockedUntil = -1;

    void expire(long long t) {
        while (!queue.empty() && parcels[queue.front().second].deadline <= t) {
            auto [code, index] = queue.front();
            queue.pop_front();
            auto it = byCode.find(code);
            if (it != byCode.end() && it->second == index) {  // 还没被取走 / not picked up yet
                byCode.erase(it);
                release(parcels[index].compartment);
                returned.push_back(parcels[index].pkg);
            }
        }
    }

    void release(int compartment) { freeBySize[sizeOf[compartment - 1]].push(compartment); }

public:
    LockerStation(const vector<int>& counts, long long keep, long long seed) : keep(keep), codes(seed), freeBySize(3) {
        int id = 1;
        for (int size = 0; size < 3; size++)
            for (int k = 0; k < counts[size]; k++, id++) {
                freeBySize[size].push(id);
                sizeOf.push_back(size);
            }
    }

    string deliver(long long t, const string& pkg, int size) {
        expire(t);
        int compartment = -1;
        for (int s = size; s < 3 && compartment < 0; s++)  // 能装下的最小尺寸 / the smallest size that fits
            if (!freeBySize[s].empty()) {
                compartment = freeBySize[s].top();
                freeBySize[s].pop();
            }
        if (compartment < 0) return "FULL";
        string code = codes.next();
        while (byCode.count(code)) code = codes.next();  // 和有效的码重复就重抽 / never reuse an active code
        parcels.push_back({pkg, compartment, t + keep});
        byCode[code] = parcels.size() - 1;
        queue.push_back({code, (int)parcels.size() - 1});
        return to_string(compartment) + " " + code;
    }

    string pickup(long long t, const string& code) {
        expire(t);
        if (t < lockedUntil) return "LOCKED";
        auto it = byCode.find(code);
        if (it == byCode.end()) {
            if (++failures == MAX_FAILURES) {  // 连续输错：锁键盘 / too many wrong codes: lock the keypad
                failures = 0;
                lockedUntil = t + LOCKOUT;
            }
            return "INVALID";
        }
        Parcel& parcel = parcels[it->second];
        byCode.erase(it);
        failures = 0;
        release(parcel.compartment);
        return parcel.pkg + " " + to_string(parcel.compartment);
    }

    string returns(long long t) {
        expire(t);
        string out;
        for (auto& pkg : returned) out += (out.empty() ? "" : " ") + pkg;
        returned.clear();
        return out.empty() ? "NONE" : out;
    }

    int free(long long t, int size) {
        expire(t);
        return freeBySize[size].size();
    }
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
