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

// 按序执行 / Run in order: three threads call first, second and third once each, in any order.
class InOrder {
    // TODO: 需要的同步工具 / the synchronization you need

public:
    void first(function<void()> job) {}  // TODO: 运行 job() / run job()

    void second(function<void()> job) {}  // TODO: first 的 job 结束后再运行 job() / run job() once first's job has finished

    void third(function<void()> job) {}  // TODO: second 的 job 结束后再运行 job() / run job() once second's job has finished
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
        string words[3];
        cin >> words[0] >> words[1] >> words[2];
        InOrder order;
        mutex mu;
        vector<string> log;
        vector<int> steps = {0, 1, 2};
        shuffle(steps.begin(), steps.end(), rng);
        vector<thread> threads;
        for (int k : steps) {
            unsigned own_seed = rng();
            threads.emplace_back([&, k, own_seed] {
                mt19937 own(own_seed);
                function<void()> job = [&] {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        log.push_back(words[k]);
                    }
                    pause(own);
                };
                pause(own);
                if (k == 0)
                    order.first(job);
                else if (k == 1)
                    order.second(job);
                else
                    order.third(job);
            });
        }
        for (auto& t : threads) t.join();
        for (size_t i = 0; i < log.size(); i++) out += (i ? " " : "") + log[i];
        out += '\n';
    }
    cout << out;
}
