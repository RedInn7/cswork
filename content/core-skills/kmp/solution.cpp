#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 前缀函数 / pi[i]: longest proper prefix of p[0..i] that is also its suffix.
vector<int> prefix_function(const string& p) {
    vector<int> pi(p.size(), 0);
    for (size_t i = 1; i < p.size(); i++) {
        int j = pi[i - 1];
        while (j > 0 && p[i] != p[j]) j = pi[j - 1];
        if (p[i] == p[j]) j++;
        pi[i] = j;
    }
    return pi;
}

// KMP 匹配 / Every start index of p in t, overlaps included, in O(|t| + |p|).
vector<int> find_all(const string& t, const string& p) {
    vector<int> pi = prefix_function(p), out;
    int j = 0;
    for (int i = 0; i < (int)t.size(); i++) {
        while (j > 0 && t[i] != p[j]) j = pi[j - 1];
        if (t[i] == p[j]) j++;
        if (j == (int)p.size()) {
            out.push_back(i - j + 1);
            j = pi[j - 1];
        }
    }
    return out;
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
