#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix.
vector<int> prefix_function(const string& p) {
    return vector<int>(p.size(), 0);  // TODO
}

// KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|).
vector<int> find_all(const string& t, const string& p) {
    return {};  // TODO
}

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string t, p;
    cin >> t >> p;
    vector<int> pi = prefix_function(p), found = find_all(t, p);
    for (size_t i = 0; i < pi.size(); i++) cout << pi[i] << (i + 1 < pi.size() ? ' ' : '\n');
    cout << found.size() << '\n';
    if (found.empty()) cout << -1;
    for (size_t i = 0; i < found.size(); i++) cout << (i ? " " : "") << found[i];
    cout << '\n';
}
