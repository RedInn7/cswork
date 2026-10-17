#include <iostream>
#include <map>
#include <numeric>
#include <optional>
#include <string>
#include <vector>
using namespace std;

const vector<int> COINS = {500, 100, 50, 10};  // 从大到小 / largest first; each divides the next larger one

struct Slot {
    int price = 0, count = 0;
};

// 贪心找零 / Greedy change from a limited pool: largest coin first, as many as there are.
// With 10 | 50 | 100 | 500 greedy finds change whenever any exists, with the fewest coins.
optional<vector<int>> makeChange(int amount, map<int, int>& pool) {
    vector<int> change;
    for (int coin : COINS) {
        int take = min(pool[coin], amount / coin);
        change.insert(change.end(), take, coin);
        amount -= take * coin;
    }
    if (amount != 0) return nullopt;
    return change;
}

// 售货机 / Vending machine: a state, slots, the cash box and the customer's escrow.
class VendingMachine {
    map<int, int> cash;  // 机器自己的硬币 / coins the machine owns
    vector<int> escrow;  // 当前顾客投入的硬币 / the current customer's coins
    map<string, Slot> slots;
    string state = "IDLE";

    int paid() const { return accumulate(escrow.begin(), escrow.end(), 0); }

public:
    VendingMachine(const map<int, int>& cash) : cash(cash) {}

    string insert(int coin) {
        if (state == "OUT_OF_SERVICE") return "NOT_NOW";
        if (coin != 10 && coin != 50 && coin != 100 && coin != 500) return "REJECTED";
        escrow.push_back(coin);
        state = "HAS_MONEY";
        return to_string(paid());
    }

    string select(const string& code) {
        if (state != "HAS_MONEY") return "NOT_NOW";
        auto it = slots.find(code);
        if (it == slots.end() || it->second.count == 0) return "SOLD_OUT";
        Slot& slot = it->second;
        if (paid() < slot.price) return "INSUFFICIENT " + to_string(slot.price - paid());
        map<int, int> pool = cash;
        for (int coin : escrow) pool[coin]++;  // 投入的硬币也能找出去 / inserted coins can go back out
        auto change = makeChange(paid() - slot.price, pool);
        if (!change) return "NO_CHANGE";  // 押金原封不动 / escrow untouched
        string out = code;
        for (int coin : *change) {  // 一次提交 / commit in one step
            pool[coin]--;
            out += " " + to_string(coin);
        }
        cash = pool;
        escrow.clear();
        slot.count--;
        state = "IDLE";
        return out;
    }

    string cancel() {
        if (state != "HAS_MONEY") return "NOT_NOW";
        string out;
        for (int coin : escrow) out += (out.empty() ? "" : " ") + to_string(coin);  // 原样退回 / the very coins
        escrow.clear();
        state = "IDLE";
        return out;
    }

    string service() {
        if (state != "IDLE") return "NOT_NOW";
        state = "OUT_OF_SERVICE";
        return "OK";
    }

    string restock(const string& code, int price, int count) {
        if (state != "OUT_OF_SERVICE") return "NOT_NOW";
        Slot& slot = slots[code];
        slot.price = price;
        slot.count += count;
        return "OK";
    }

    string resume() {
        if (state != "OUT_OF_SERVICE") return "NOT_NOW";
        state = "IDLE";
        return "OK";
    }

    string cashBox() {
        return to_string(cash[10]) + " " + to_string(cash[50]) + " " + to_string(cash[100]) + " " + to_string(cash[500]);
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    map<int, int> cash;
    for (int coin : {10, 50, 100, 500}) cin >> cash[coin];
    VendingMachine machine(cash);
    int q, coin, price, count;
    string op, code;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "insert") {
            cin >> coin;
            cout << machine.insert(coin) << '\n';
        } else if (op == "select") {
            cin >> code;
            cout << machine.select(code) << '\n';
        } else if (op == "cancel") {
            cout << machine.cancel() << '\n';
        } else if (op == "service") {
            cout << machine.service() << '\n';
        } else if (op == "restock") {
            cin >> code >> price >> count;
            cout << machine.restock(code, price, count) << '\n';
        } else if (op == "resume") {
            cout << machine.resume() << '\n';
        } else {
            cout << machine.cashBox() << '\n';
        }
    }
}
