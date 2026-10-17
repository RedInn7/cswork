#include <deque>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

const int MAX_SEATS = 10;
enum class Status { ACTIVE, BOOKED, RELEASED, EXPIRED };

struct Hold {
    string user;
    vector<int> seats;
    long long expires;
    Status status = Status::ACTIVE;
};

// 一场电影的座位 / One show's seats: each seat points at the hold that has it, or 0 when free.
class Show {
    long long ttl;
    vector<int> owner;   // seat -> hold id, 0: free
    vector<Hold> holds;  // hold id - 1 -> hold
    deque<int> queue;    // 按过期时间排好的锁座 / hold ids in expiry order (one TTL for all)
    int freeCount;

    // 到期的锁座自动释放 / Release every active hold whose time is up (expires <= t).
    void expire(long long t) {
        while (!queue.empty() && holds[queue.front() - 1].expires <= t) {
            Hold& hold = holds[queue.front() - 1];
            queue.pop_front();
            if (hold.status == Status::ACTIVE) {
                hold.status = Status::EXPIRED;
                freeSeats(hold);
            }
        }
    }

    void freeSeats(const Hold& hold) {
        for (int s : hold.seats) owner[s] = 0;
        freeCount += hold.seats.size();
    }

    string finish(long long t, long long id, const string& user, Status to) {
        expire(t);
        if (id < 1 || id > (long long)holds.size() || holds[id - 1].user != user) return "INVALID";
        Hold& hold = holds[id - 1];
        if (hold.status == Status::EXPIRED) return "EXPIRED";
        if (hold.status != Status::ACTIVE) return "INVALID";
        hold.status = to;
        if (to == Status::RELEASED) freeSeats(hold);
        return "OK";
    }

public:
    Show(int seats, long long ttl) : ttl(ttl), owner(seats + 1, 0), freeCount(seats) {}

    string hold(long long t, const string& user, const vector<int>& seats) {
        expire(t);
        if ((int)seats.size() > MAX_SEATS) return "TOO_MANY";
        for (int s : seats)  // 全有或全无 / all or nothing
            if (owner[s]) return "UNAVAILABLE " + to_string(s);
        holds.push_back({user, seats, t + ttl});
        int id = holds.size();
        queue.push_back(id);
        for (int s : seats) owner[s] = id;
        freeCount -= seats.size();
        return to_string(id);
    }

    string confirm(long long t, long long id, const string& user) { return finish(t, id, user, Status::BOOKED); }

    string release(long long t, long long id, const string& user) { return finish(t, id, user, Status::RELEASED); }

    int free(long long t) {
        expire(t);
        return freeCount;
    }

    string seat(long long t, int s) {
        expire(t);
        if (!owner[s]) return "FREE";
        const Hold& hold = holds[owner[s] - 1];
        return (hold.status == Status::BOOKED ? "BOOKED " : "HELD ") + hold.user;
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int seats, q, k, s;
    long long ttl, t, id;
    string op, user;
    cin >> seats >> ttl >> q;
    Show show(seats, ttl);
    while (q--) {
        cin >> op >> t;
        if (op == "hold") {
            cin >> user >> k;
            vector<int> chosen(k);
            for (int& c : chosen) cin >> c;
            cout << show.hold(t, user, chosen) << '\n';
        } else if (op == "confirm" || op == "release") {
            cin >> id >> user;
            cout << (op == "confirm" ? show.confirm(t, id, user) : show.release(t, id, user)) << '\n';
        } else if (op == "free") {
            cout << show.free(t) << '\n';
        } else {
            cin >> s;
            cout << show.seat(t, s) << '\n';
        }
    }
}
