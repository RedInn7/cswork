#include <iostream>
#include <map>
#include <numeric>
#include <optional>
#include <string>
#include <vector>
using namespace std;

// 售货机 / Vending machine. 状态 / states: IDLE, HAS_MONEY, OUT_OF_SERVICE. 收 / accepts 10, 50, 100, 500.
// 建议拆出 / Suggested: Slot（价格和库存 / price and stock）, makeChange（贪心找零 / greedy change）;
// 顾客的硬币（押金）和机器的钱箱分开放 / keep the customer's escrow apart from the cash box.
class VendingMachine {
public:
    VendingMachine(const map<int, int>& cash) {}  // TODO: cash[coin]: 钱箱里该面值的硬币数 / coins in the box

    string insert(int coin) { return ""; }  // TODO: 已投总额 / the escrow total, "REJECTED" or "NOT_NOW"

    string select(const string& code) { return ""; }  // TODO: "<code> <change...>", "SOLD_OUT", "INSUFFICIENT <n>", "NO_CHANGE", "NOT_NOW"

    string cancel() { return ""; }  // TODO: 按投入顺序退回 / the coins back in the order inserted, or "NOT_NOW"

    string service() { return ""; }  // TODO: "OK" or "NOT_NOW"

    string restock(const string& code, int price, int count) { return ""; }  // TODO: "OK" or "NOT_NOW"

    string resume() { return ""; }  // TODO: "OK" or "NOT_NOW"

    string cashBox() { return ""; }  // TODO: 钱箱里 10 50 100 500 各几枚 / coins of 10 50 100 500 in the box
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
