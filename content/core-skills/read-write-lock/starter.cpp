#include <algorithm>
#include <atomic>
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

// 读写锁 / Read-write lock: many readers at once, or a single writer alone.
// Build it yourself: no std::shared_mutex.
class RWLock {
    // TODO: 锁、条件变量和计数 / a lock, a condition variable and some counts

public:
    void acquire_read() {}  // TODO: 没有写者时进入 / get in once no writer holds the lock

    void release_read() {}  // TODO

    void acquire_write() {}  // TODO: 没有读者也没有写者时进入 / get in once nobody else holds the lock

    void release_write() {}  // TODO
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
static string out;
static mutex failing;
static mt19937 rng;

static void pause(mt19937& own) {
    double r = uniform_real_distribution<double>(0, 1)(own);
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

static void run(vector<function<void(mt19937&)>> workers) {
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
}

int main() {
    unsigned seed;
    int rounds;
    cin >> seed >> rounds;
    rng.seed(seed);
    for (int r = 1; r <= rounds; r++) {
        string kind;
        cin >> kind;
        RWLock lock;
        if (kind == "hold") {
            // While the driver holds the lock, threads that try to get in must stay out.
            atomic<int> entered{0};
            auto kept_out = [&](const string& message) {
                for (int i = 0; i < 100 && !entered; i++) this_thread::sleep_for(chrono::milliseconds(1));
                if (entered) fail(r, message);
            };
            lock.acquire_write();
            thread reader([&] {
                lock.acquire_read();
                entered++;
                lock.release_read();
            });
            thread writer([&] {
                lock.acquire_write();
                entered++;
                lock.release_write();
            });
            kept_out("a thread got in while the write lock was held");
            lock.release_write();
            reader.join();
            writer.join();
            entered = 0;
            lock.acquire_read();
            thread late([&] {
                lock.acquire_write();
                entered++;
                lock.release_write();
            });
            kept_out("a writer got in while a read lock was held");
            lock.release_read();
            late.join();
            out += "held\n";
        } else if (kind == "share") {
            // Every reader must be able to hold the read lock at once.
            int n;
            cin >> n;
            mutex mu;
            condition_variable cv;
            int arrived = 0;
            run(vector<function<void(mt19937&)>>(n, [&](mt19937& own) {
                pause(own);
                lock.acquire_read();
                unique_lock<mutex> hold(mu);
                if (++arrived == n) cv.notify_all();
                if (!cv.wait_for(hold, chrono::seconds(2), [&] { return arrived == n; }))
                    fail(r, to_string(n) + " readers could not hold the read lock at the same time");
                hold.unlock();
                lock.release_read();
            }));
            out += to_string(n) + "\n";
        } else {
            int readers, writers, ops;
            cin >> readers >> writers >> ops;
            mutex mu;
            long long data[2] = {0, 0};  // a writer adds its value to both; a reader must never see them differ
            int readers_in = 0, writers_in = 0;
            vector<function<void(mt19937&)>> workers(readers, [&](mt19937& own) {
                for (int n = 0; n < ops; n++) {
                    pause(own);
                    lock.acquire_read();
                    {
                        lock_guard<mutex> guard(mu);
                        if (writers_in) fail(r, "a reader got in while a writer held the lock");
                        readers_in++;
                    }
                    long long a = data[0];
                    pause(own);
                    long long b = data[1];
                    if (a != b) fail(r, "a reader saw a half-done write (" + to_string(a) + " and " + to_string(b) + ")");
                    {
                        lock_guard<mutex> guard(mu);
                        readers_in--;
                    }
                    lock.release_read();
                }
            });
            for (int i = 0; i < writers; i++) {
                long long v;
                cin >> v;
                workers.push_back([&, v](mt19937& own) {
                    for (int n = 0; n < ops; n++) {
                        pause(own);
                        lock.acquire_write();
                        {
                            lock_guard<mutex> guard(mu);
                            if (readers_in || writers_in) fail(r, "a writer got in while another thread held the lock");
                            writers_in++;
                        }
                        long long a = data[0];
                        pause(own);
                        data[0] = a + v;
                        pause(own);
                        data[1] += v;
                        {
                            lock_guard<mutex> guard(mu);
                            writers_in--;
                        }
                        lock.release_write();
                    }
                });
            }
            run(workers);
            out += to_string(data[0]) + "\n";
        }
    }
    cout << out;
}
