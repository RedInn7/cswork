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

// 造水分子 / Water: one thread per atom; bond() calls come in threes, two hydrogens and one oxygen.
class H2O {
    mutex mu;
    condition_variable cv;
    int h = 0, o = 0;  // atoms let into the molecule being built
    int bonded = 0;    // of those, how many have bonded

    void join(bool hydrogen, function<void()>& bond) {
        unique_lock<mutex> lock(mu);
        cv.wait(lock, [&] { return hydrogen ? h < 2 : o < 1; });  // a free seat for this atom
        (hydrogen ? h : o)++;
        cv.notify_all();
        cv.wait(lock, [&] { return h == 2 && o == 1; });  // the molecule is complete
        lock.unlock();
        bond();
        lock.lock();
        if (++bonded == 3) {
            h = o = bonded = 0;  // all three bonded: open the next molecule
            cv.notify_all();
        }
    }

public:
    void hydrogen(function<void()> bond) { join(true, bond); }

    void oxygen(function<void()> bond) { join(false, bond); }
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
