#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <iostream>
#include <utility>
#include <vector>
using namespace std;
struct Node { uint32_t value, count; };

uint64_t minimumCost(vector<uint32_t> values) {
    if (*min_element(values.begin(), values.end()) == 1) return values.size();
    sort(values.begin(), values.end());
    vector<Node> nodes;
    nodes.reserve(values.size());
    uint64_t answer = 0;
    for (uint32_t value : values) {
        answer += value;
        if (!nodes.empty() && nodes.back().value == value) ++nodes.back().count;
        else nodes.push_back({value, 1});
    }
    uint32_t maximum = values.back();
    vector<uint32_t>().swap(values);
    vector<uint64_t> alive((size_t(maximum) + 64) / 64, 0);
    for (auto node : nodes) alive[node.value >> 6] |= uint64_t(1) << (node.value & 63);
    for (auto node : nodes) {
        uint32_t d = node.value;
        uint64_t mask = uint64_t(1) << (d & 63);
        if (!(alive[d >> 6] & mask)) continue;
        alive[d >> 6] &= ~mask;
        for (uint32_t multiple = d + d; multiple <= maximum; multiple += d) {
            uint64_t bit = uint64_t(1) << (multiple & 63);
            auto& word = alive[multiple >> 6];
            if (!(word & bit)) continue;
            word &= ~bit;
            auto found = lower_bound(nodes.begin(), nodes.end(), multiple,
                [](const Node& item, uint32_t value) { return item.value < value; });
            answer += uint64_t(d) * found->count;
            answer -= uint64_t(multiple) * found->count;
        }
    }
    return answer;
}

uint32_t readNumber() {
    int c = getchar_unlocked();
    while (c != EOF && c <= 32) c = getchar_unlocked();
    uint32_t value = 0;
    while (c != EOF && c > 32) { value = value * 10 + (c - '0'); c = getchar_unlocked(); }
    return value;
}
int main() {
    uint32_t n = readNumber();
    vector<uint32_t> values(n);
    for (auto& value : values) value = readNumber();
    cout << minimumCost(std::move(values)) << '\n';
}
