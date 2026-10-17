#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <vector>
using namespace std;

const vector<int> NOTES = {100, 50, 10};  // 从大到小 / largest first; each divides the next larger one
const int LIMIT = 2000;                   // 单笔上限 / per-withdrawal limit
const int MAX_TRIES = 3;

struct Account {
    string pin;
    long long balance;
    int failures = 0;  // 连续输错 PIN 的次数 / consecutive wrong PINs
    bool locked = false;
};

class CashDispenser {
public:
    map<int, int> counts;

    // 贪心配钞 / Greedy notes, largest first; nullopt when the cassettes cannot pay exactly.
    optional<vector<pair<int, int>>> plan(int amount) {
        vector<pair<int, int>> notes;
        for (int note : NOTES) {
            int take = min(counts[note], amount / note);
            notes.push_back({note, take});
            amount -= take * note;
        }
        if (amount != 0) return nullopt;
        return notes;
    }

    void dispense(const vector<pair<int, int>>& notes) {
        for (auto [note, n] : notes) counts[note] -= n;
    }
};

class ATM;

// 状态接口：默认都是“现在不行” / The state interface: every action defaults to "not now".
struct State {
    virtual ~State() = default;
    virtual string insert(ATM&, const string&) { return "NOT_NOW"; }
    virtual string pin(ATM&, const string&) { return "NOT_NOW"; }
    virtual string balance(ATM&) { return "NOT_NOW"; }
    virtual string withdraw(ATM&, long long) { return "NOT_NOW"; }
    virtual string eject(ATM&) { return "NOT_NOW"; }
};

struct IdleState : State {
    string insert(ATM& atm, const string& card) override;
};

struct CardInsertedState : State {
    string pin(ATM& atm, const string& pin) override;
    string eject(ATM& atm) override;
};

struct AuthenticatedState : CardInsertedState {
    string pin(ATM&, const string&) override { return "NOT_NOW"; }
    string balance(ATM& atm) override;
    string withdraw(ATM& atm, long long amount) override;
};

// ATM：门面，持有当前状态、会话里的账户和出钞机 / Facade: the current state, the session's account, the dispenser.
class ATM {
public:
    IdleState idle;
    CardInsertedState cardInserted;
    AuthenticatedState authenticated;
    CashDispenser dispenser;
    map<string, Account> accounts;
    Account* account = nullptr;
    State* state = &idle;

    ATM(const vector<int>& counts, const map<string, pair<string, long long>>& cards) {
        dispenser.counts = {{10, counts[0]}, {50, counts[1]}, {100, counts[2]}};
        for (auto& [card, info] : cards) accounts[card] = Account{info.first, info.second};
    }

    void endSession() {
        account = nullptr;
        state = &idle;
    }

    string insert(const string& card) { return state->insert(*this, card); }
    string pin(const string& pin) { return state->pin(*this, pin); }
    string balance() { return state->balance(*this); }
    string withdraw(long long amount) { return state->withdraw(*this, amount); }
    string eject() { return state->eject(*this); }

    string cash() {
        return to_string(dispenser.counts[10]) + " " + to_string(dispenser.counts[50]) + " " + to_string(dispenser.counts[100]);
    }
};

string IdleState::insert(ATM& atm, const string& card) {
    auto it = atm.accounts.find(card);
    if (it == atm.accounts.end()) return "UNKNOWN_CARD";
    if (it->second.locked) return "CARD_LOCKED";
    atm.account = &it->second;
    atm.state = &atm.cardInserted;
    return "OK";
}

string CardInsertedState::pin(ATM& atm, const string& pin) {
    Account& account = *atm.account;
    if (pin == account.pin) {
        account.failures = 0;
        atm.state = &atm.authenticated;
        return "OK";
    }
    if (++account.failures == MAX_TRIES) {
        account.locked = true;  // 吞卡，结束会话 / keep the card, end the session
        atm.endSession();
        return "LOCKED";
    }
    return "WRONG_PIN " + to_string(MAX_TRIES - account.failures);
}

string CardInsertedState::eject(ATM& atm) {
    atm.endSession();
    return "OK";
}

string AuthenticatedState::balance(ATM& atm) { return to_string(atm.account->balance); }

string AuthenticatedState::withdraw(ATM& atm, long long amount) {
    if (amount <= 0 || amount % 10) return "BAD_AMOUNT";
    if (amount > LIMIT) return "OVER_LIMIT";
    if (amount > atm.account->balance) return "INSUFFICIENT_FUNDS";
    auto notes = atm.dispenser.plan(amount);
    if (!notes) return "NO_NOTES";
    atm.account->balance -= amount;  // 先确认能出钞，再扣款 / debit only once the notes are certain
    atm.dispenser.dispense(*notes);
    string out;
    for (auto [note, n] : *notes)
        if (n) out += (out.empty() ? "" : " ") + to_string(note) + "x" + to_string(n);
    return out;
}

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
