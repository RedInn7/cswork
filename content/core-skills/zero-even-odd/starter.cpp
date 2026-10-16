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

// 零、偶、奇 / Zero, even, odd: together emit 0 1 0 2 0 3 ... 0 n, one thread per method.
class ZeroEvenOdd {
    int n;
    // TODO: 需要的同步工具 / the synchronization you need

public:
    ZeroEvenOdd(int n) : n(n) {}

    void zero(function<void(int)> emit) {}  // TODO: 调用 n 次 emit(0)，每个数之前一次 / call emit(0) n times, once before each number

    void even(function<void(int)> emit) {}  // TODO: 按顺序 emit 2, 4, 6, ... / emit 2, 4, 6, ... in order

    void odd(function<void(int)> emit) {}  // TODO: 按顺序 emit 1, 3, 5, ... / emit 1, 3, 5, ... in order
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
        cin >> n;
        ZeroEvenOdd trio(n);
        mutex mu;
        vector<int> log;
        vector<int> methods = {0, 1, 2};
        shuffle(methods.begin(), methods.end(), rng);
        vector<thread> threads;
        for (int k : methods) {
            unsigned own_seed = rng();
            threads.emplace_back([&, k, own_seed] {
                mt19937 own(own_seed);
                function<void(int)> emit = [&](int x) {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        log.push_back(x);
                    }
                    pause(own);
                };
                pause(own);
                if (k == 0)
                    trio.zero(emit);
                else if (k == 1)
                    trio.even(emit);
                else
                    trio.odd(emit);
            });
        }
        for (auto& t : threads) t.join();
        for (size_t i = 0; i < log.size(); i++) out += (i ? " " : "") + to_string(log[i]);
        out += '\n';
    }
    cout << out;
}
