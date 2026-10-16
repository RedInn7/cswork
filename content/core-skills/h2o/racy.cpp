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

// No synchronization: every atom bonds as soon as it arrives.
class H2O {
public:
    void hydrogen(function<void()> bond) { bond(); }

    void oxygen(function<void()> bond) { bond(); }
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
        string atoms;
        cin >> atoms;
        H2O water;
        mutex mu;
        string log;
        vector<thread> threads;
        for (char atom : atoms) {
            unsigned own_seed = rng();
            threads.emplace_back([&, r, atom, own_seed] {
                mt19937 own(own_seed);
                function<void()> bond = [&] {
                    pause(own);
                    {
                        lock_guard<mutex> guard(mu);
                        string group = log.substr(log.size() - log.size() % 3);
                        string molecule = to_string(log.size() / 3 + 1);
                        if (atom == 'H' && count(group.begin(), group.end(), 'H') == 2)
                            fail(r, "molecule " + molecule + " got a third hydrogen");
                        if (atom == 'O' && group.find('O') != string::npos)
                            fail(r, "molecule " + molecule + " got a second oxygen");
                        log += atom;
                    }
                    pause(own);
                };
                pause(own);
                if (atom == 'H')
                    water.hydrogen(bond);
                else
                    water.oxygen(bond);
            });
        }
        for (auto& t : threads) t.join();
        if (log.size() != atoms.size())
            fail(r, to_string(log.size()) + " of " + to_string(atoms.size()) + " atoms bonded");
        out += to_string(atoms.size() / 3) + "\n";
    }
    cout << out;
}
