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
    mutex mu;
    condition_variable cv;
    int next = 0;  // the next value to emit: 0 for the zero thread, otherwise that number
    int last = 0;  // the last number emitted

    // Emits from, from + step, ... up to n (or 0 that many times for zero), each on its turn.
    void take_turns(int from, int step, function<void(int)>& emit, bool zero) {
        for (int i = from; i <= n; i += step) {
            unique_lock<mutex> lock(mu);
            cv.wait(lock, [&] { return zero ? next == 0 : next == i; });
            emit(zero ? 0 : i);
            if (zero) {
                next = last + 1;
            } else {
                next = 0;
                last = i;
            }
            cv.notify_all();
        }
    }

public:
    ZeroEvenOdd(int n) : n(n) {}

    void zero(function<void(int)> emit) { take_turns(1, 1, emit, true); }

    void even(function<void(int)> emit) { take_turns(2, 2, emit, false); }

    void odd(function<void(int)> emit) { take_turns(1, 2, emit, false); }
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
