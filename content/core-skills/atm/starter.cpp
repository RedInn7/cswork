#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <vector>
using namespace std;

// ATM / Cash machine.
// 建议用状态模式 / Suggested: the State pattern, IdleState, CardInsertedState, AuthenticatedState,
// 每个状态只覆盖自己允许的操作，其余默认返回 "NOT_NOW" / each state overrides only what it allows.
// 再拆出 / plus Account（PIN、余额、连续输错次数 / PIN, balance, wrong tries）and CashDispenser（配钞 / notes）.
class ATM {
public:
    // counts: 10、50、100 面额的张数 / notes of 10, 50, 100; cards[card] = {pin, balance}
    ATM(const vector<int>& counts, const map<string, pair<string, long long>>& cards) {}  // TODO

    string insert(const string& card) { return ""; }  // TODO: "OK", "UNKNOWN_CARD", "CARD_LOCKED", "NOT_NOW"
    string pin(const string& pin) { return ""; }      // TODO: "OK", "WRONG_PIN <left>", "LOCKED", "NOT_NOW"
    string balance() { return ""; }                   // TODO: 余额 / the balance, or "NOT_NOW"
    string withdraw(long long amount) { return ""; }  // TODO: "100x1 10x2", "BAD_AMOUNT", "OVER_LIMIT", "INSUFFICIENT_FUNDS", "NO_NOTES", "NOT_NOW"
    string eject() { return ""; }                     // TODO: "OK" or "NOT_NOW"
    string cash() { return ""; }                      // TODO: 10、50、100 面额各剩几张 / notes of 10, 50, 100 left
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    vector<int> counts(3);
    for (int& c : counts) cin >> c;
    int n, q;
    cin >> n;
    map<string, pair<string, long long>> cards;
    string card, pin, op;
    long long balance, amount;
    for (int i = 0; i < n; i++) {
        cin >> card >> pin >> balance;
        cards[card] = {pin, balance};
    }
    ATM atm(counts, cards);
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "insert") {
            cin >> card;
            cout << atm.insert(card) << '\n';
        } else if (op == "pin") {
            cin >> pin;
            cout << atm.pin(pin) << '\n';
        } else if (op == "balance") {
            cout << atm.balance() << '\n';
        } else if (op == "withdraw") {
            cin >> amount;
            cout << atm.withdraw(amount) << '\n';
        } else if (op == "eject") {
            cout << atm.eject() << '\n';
        } else {
            cout << atm.cash() << '\n';
        }
    }
}
