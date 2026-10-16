#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <iostream>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <vector>
using namespace std;

// No synchronization: each side emits as fast as it can.
class FooBar {
    int n;

public:
    FooBar(int n) : n(n) {}

    void foo(function<void()> emit) {
        for (int i = 0; i < n; i++) emit();
    }

    void bar(function<void()> emit) {
        for (int i = 0; i < n; i++) emit();
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
static void pause(mt19937& rng) {
    double r = uniform_real_distribution<double>(0, 1)(rng);
    if (r < 0.4)
        this_thread::yield();
    else if (r < 0.45)
        this_thread::sleep_for(chrono::microseconds(50));
}

int main() {
    unsigned seed;
    int rounds;
    cin >> seed >> rounds;
    mt19937 rng(seed);
    string out;
    for (int r = 0; r < rounds; r++) {
        int n;
        string words[2];
        cin >> n >> words[0] >> words[1];
        FooBar pair(n);
        mutex mu;
        vector<string> log;
        vector<int> sides = {0, 1};
        shuffle(sides.begin(), sides.end(), rng);
        vector<thread> threads;
        for (int k : sides) {
            unsigned own_seed = rng();
            threads.emplace_back([&, k, own_seed] {
                mt19937 own(own_seed);
                function<void()> emit = [&] {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        log.push_back(words[k]);
                    }
                    pause(own);
                };
                pause(own);
                if (k == 0)
                    pair.foo(emit);
                else
                    pair.bar(emit);
            });
        }
        for (auto& t : threads) t.join();
        for (size_t i = 0; i < log.size(); i++) out += (i ? " " : "") + log[i];
        out += '\n';
    }
    cout << out;
}
