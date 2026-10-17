#include <algorithm>
#include <iostream>
#include <map>
#include <numeric>
#include <optional>
#include <queue>
#include <string>
#include <vector>
using namespace std;
using Shares = optional<vector<long long>>;

Shares splitEqual(long long amount, size_t k) {
    vector<long long> shares(k, amount / (long long)k);
    for (size_t i = 0; i < (size_t)(amount % (long long)k); i++) shares[i]++;
    return shares;
}

Shares splitExact(long long amount, const vector<long long>& values) {
    if (accumulate(values.begin(), values.end(), 0LL) != amount) return nullopt;
    return values;
}

// 万分比，向下取整，剩下的分按余数从大到小补，余数相同按列出顺序 / round down, leftover cents by remainder.
Shares splitPercent(long long amount, const vector<long long>& bps) {
    if (accumulate(bps.begin(), bps.end(), 0LL) != 10000) return nullopt;
    vector<long long> shares;
    for (long long bp : bps) shares.push_back(amount * bp / 10000);
    long long left = amount - accumulate(shares.begin(), shares.end(), 0LL);
    vector<size_t> order(bps.size());
    iota(order.begin(), order.end(), 0);
    stable_sort(order.begin(), order.end(), [&](size_t a, size_t b) { return amount * bps[a] % 10000 > amount * bps[b] % 10000; });
    for (long long i = 0; i < left; i++) shares[order[i]]++;
    return shares;
}

// 一组人的账本 / A group's ledger: net balances, > 0 is owed money, < 0 owes.
class Group {
    map<string, long long> net;

public:
    string addExpense(const string& payer, long long amount, const string& kind, const vector<string>& people,
                      const vector<long long>& values) {
        Shares shares = kind == "EQUAL"   ? splitEqual(amount, people.size())
                        : kind == "EXACT" ? splitExact(amount, values)
                                          : splitPercent(amount, values);
        if (!shares) return "INVALID";
        net[payer] += amount;
        string out;
        for (size_t i = 0; i < people.size(); i++) {
            net[people[i]] -= (*shares)[i];
            out += (i ? " " : "") + to_string((*shares)[i]);
        }
        return out;
    }

    string pay(const string& from, const string& to, long long amount) {
        net[from] += amount;
        net[to] -= amount;
        return "OK";
    }

    long long balance(const string& user) {
        auto it = net.find(user);
        return it == net.end() ? 0 : it->second;
    }

    // 最大债务人付给最大债权人，金额相同按名字 / Largest debtor pays largest creditor; ties by name.
    string settle() {
        using Entry = pair<long long, string>;  // (-amount, name): the top is the largest, then the first name
        priority_queue<Entry, vector<Entry>, greater<Entry>> debtors, creditors;
        for (auto& [user, v] : net) {
            if (v < 0) debtors.push({v, user});
            if (v > 0) creditors.push({-v, user});
        }
        vector<string> transfers;
        while (!debtors.empty() && !creditors.empty()) {
            auto [d, du] = debtors.top();
            debtors.pop();
            auto [c, cu] = creditors.top();
            creditors.pop();
            long long pay = min(-d, -c);
            transfers.push_back(du + " " + cu + " " + to_string(pay));
            if (-d > pay) debtors.push({d + pay, du});
            if (-c > pay) creditors.push({c + pay, cu});
        }
        string out = to_string(transfers.size());
        for (auto& t : transfers) out += " " + t;
        return out;
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    Group group;
    int q, k;
    string op, payer, kind, from, to, person;
    long long amount, value;
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "expense") {
            cin >> payer >> amount >> kind >> k;
            vector<string> people;
            vector<long long> values;
            for (int i = 0; i < k; i++) {
                cin >> person;
                people.push_back(person);
                if (kind != "EQUAL") {
                    cin >> value;
                    values.push_back(value);
                }
            }
            cout << group.addExpense(payer, amount, kind, people, values) << '\n';
        } else if (op == "pay") {
            cin >> from >> to >> amount;
            cout << group.pay(from, to, amount) << '\n';
        } else if (op == "balance") {
            cin >> person;
            cout << group.balance(person) << '\n';
        } else {
            cout << group.settle() << '\n';
        }
    }
}
