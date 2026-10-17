#include <algorithm>
#include <iostream>
#include <map>
#include <numeric>
#include <optional>
#include <queue>
#include <string>
#include <vector>
using namespace std;

// 一组人的账本 / A group's ledger.
// 建议拆出 / Suggested: 三种分账规则（策略） / three split rules (strategies), EQUAL, EXACT and PERCENT,
// each turning an amount into cents owed per participant; 只存每人的净额 / keep net balances only.
class Group {
public:
    // kind: "EQUAL"（values 为空 / values empty）, "EXACT"（金额 / cents）, "PERCENT"（万分比 / basis points）
    string addExpense(const string& payer, long long amount, const string& kind, const vector<string>& people,
                      const vector<long long>& values) {
        return "";  // TODO: 各人份额 / each share in order, or "INVALID"
    }

    string pay(const string& from, const string& to, long long amount) { return ""; }  // TODO: "OK"

    long long balance(const string& user) { return 0; }  // TODO: 净额，> 0 别人欠他 / net, > 0 means owed money

    string settle() { return ""; }  // TODO: "<count> <from> <to> <amount> ..."
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
