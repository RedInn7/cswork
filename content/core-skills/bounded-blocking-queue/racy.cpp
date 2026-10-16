#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <deque>
#include <functional>
#include <iostream>
#include <mutex>
#include <random>
#include <string>
#include <thread>
#include <vector>
using namespace std;

// No lock and no capacity check: put never waits, take spins until something shows up.
class BoundedBlockingQueue {
    deque<int> items;

public:
    BoundedBlockingQueue(int) {}

    void put(int x) { items.push_back(x); }

    int take() {
        while (items.empty()) this_thread::yield();
        int x = items.front();
        items.pop_front();
        return x;
    }
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
        int capacity, producers, consumers, k;
        cin >> capacity >> producers >> consumers >> k;
        int total = producers * k;
        BoundedBlockingQueue queue(capacity);
        mutex mu;
        vector<bool> started(total + 1), taken(total + 1);
        long long puts = 0, takes = 0, done = 0, sum = 0;  // puts returned, takes begun, takes returned, sum taken
        vector<function<void(mt19937&)>> workers;
        for (int i = 0; i < producers; i++)
            workers.push_back([&, r, i](mt19937& own) {
                for (int x = i * k + 1; x <= i * k + k; x++) {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        started[x] = true;
                    }
                    queue.put(x);
                    lock_guard<mutex> guard(mu);
                    // At least puts - takes items are inside the queue right now.
                    if (++puts - takes > capacity)
                        fail(r, "the queue went over its capacity of " + to_string(capacity));
                }
            });
        for (int j = 0; j < consumers; j++) {
            int share = total / consumers + (j < total % consumers);
            workers.push_back([&, r, share](mt19937& own) {
                vector<int> last(producers);  // the last item this consumer took from each producer
                if (uniform_real_distribution<double>(0, 1)(own) < 0.5)
                    this_thread::sleep_for(chrono::milliseconds(1));  // let the producers run ahead
                for (int n = 0; n < share; n++) {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        takes++;
                    }
                    int x = queue.take();
                    lock_guard<mutex> guard(mu);
                    if (x < 1 || x > total || !started[x])
                        fail(r, "take() returned " + to_string(x) + ", which was never put");
                    if (taken[x]) fail(r, to_string(x) + " was taken twice");
                    int p = (x - 1) / k;
                    if (x < last[p])
                        fail(r, to_string(x) + " came out after " + to_string(last[p]) + ", though it was put first");
                    taken[x] = true;
                    last[p] = x;
                    done++;
                    sum += x;
                }
            });
        }
        shuffle(workers.begin(), workers.end(), rng);
        vector<thread> threads;
        for (auto& work : workers) {
            unsigned own_seed = rng();
            threads.emplace_back([&work, own_seed] {
                mt19937 own(own_seed);
                work(own);
            });
        }
        for (auto& t : threads) t.join();
        if (done != total) fail(r, "only " + to_string(done) + " of " + to_string(total) + " items came out");
        out += to_string(total) + " " + to_string(sum) + "\n";
    }
    cout << out;
}
