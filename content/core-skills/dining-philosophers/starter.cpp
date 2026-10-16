#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <vector>
using namespace std;

// 哲学家就餐 / Dining philosophers: n at a round table, fork p between philosopher p and p + 1.
class DiningTable {
    int n;
    // TODO: 需要的同步工具 / the synchronization you need

public:
    DiningTable(int n) : n(n) {}

    // TODO: 拿起叉子 p 和 (p + 1) % n，吃一次，再放下这两把叉子
    //       pick up forks p and (p + 1) % n, eat once, then put both down
    void dine(int p, function<void(int)> pick, function<void()> eat, function<void(int)> drop) {}
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
static string out;
static mutex failing;

static void pause(mt19937& rng) {
    double r = uniform_real_distribution<double>(0, 1)(rng);
    if (r < 0.4)
        this_thread::yield();
    else if (r < 0.45)
        this_thread::sleep_for(chrono::microseconds(50));
}

[[noreturn]] static void fail(int round, const string& message) {
    failing.lock();
    cout << out << "round " << round << ": " << message << endl;
    _Exit(0);
}

int main() {
    unsigned seed;
    int rounds;
    cin >> seed >> rounds;
    mt19937 rng(seed);
    for (int r = 1; r <= rounds; r++) {
        int n;
        cin >> n;
        vector<int> wanted(n), holder(n, -1), meals(n);
        for (int& m : wanted) cin >> m;
        DiningTable table(n);
        mutex mu;
        vector<int> order(n);
        for (int p = 0; p < n; p++) order[p] = p;
        shuffle(order.begin(), order.end(), rng);
        vector<thread> threads;
        for (int p : order) {
            unsigned own_seed = rng();
            threads.emplace_back([&, r, p, own_seed] {
                mt19937 own(own_seed);
                int left = p, right = (p + 1) % n;
                string who = "philosopher " + to_string(p);
                function<void(int)> pick = [&](int f) {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        if (f != left && f != right)
                            fail(r, who + " picked up fork " + to_string(f) + ", which is not next to them");
                        if (holder[f] != -1)
                            fail(r, who + " picked up fork " + to_string(f) + " while philosopher " +
                                        to_string(holder[f]) + " held it");
                        holder[f] = p;
                    }
                    pause(own);
                };
                function<void()> eat = [&] {
                    {
                        lock_guard<mutex> guard(mu);
                        if (holder[left] != p || holder[right] != p)
                            fail(r, who + " ate without holding forks " + to_string(left) + " and " + to_string(right));
                        meals[p]++;
                    }
                    pause(own);
                };
                function<void(int)> drop = [&](int f) {
                    pause(own);
                    lock_guard<mutex> guard(mu);
                    if (holder[f] != p) fail(r, who + " put down fork " + to_string(f) + " without holding it");
                    holder[f] = -1;
                };
                for (int i = 0; i < wanted[p]; i++) {
                    pause(own);
                    int before;
                    {
                        lock_guard<mutex> guard(mu);
                        before = meals[p];
                    }
                    table.dine(p, pick, eat, drop);
                    lock_guard<mutex> guard(mu);
                    if (meals[p] != before + 1)
                        fail(r, who + " ate " + to_string(meals[p] - before) + " times in one dine call");
                    if (holder[left] == p || holder[right] == p) fail(r, who + " left the table holding a fork");
                }
            });
        }
        for (auto& t : threads) t.join();
        for (int p = 0; p < n; p++) out += (p ? " " : "") + to_string(meals[p]);
        out += '\n';
    }
    cout << out;
}
