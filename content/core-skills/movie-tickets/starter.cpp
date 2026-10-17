#include <deque>
#include <iostream>
#include <string>
#include <vector>
using namespace std;

// 一场电影的座位 / One show's seats.
// 建议拆出 / Suggested: Hold（锁座：用户、座位、过期时刻、状态 / user, seats, expiry, status）;
// 每个座位记住占着它的锁座 / each seat remembers the hold that has it; 到期的锁座在每个操作开始时释放
// / release expired holds at the start of every operation.
class Show {
public:
    Show(int seats, long long ttl) {}  // TODO: 座位编号 1..seats / seats 1..seats; holds expire ttl after they are made

    string hold(long long t, const string& user, const vector<int>& seats) { return ""; }  // TODO: id, "TOO_MANY", "UNAVAILABLE <seat>"

    string confirm(long long t, long long id, const string& user) { return ""; }  // TODO: "OK", "EXPIRED", "INVALID"

    string release(long long t, long long id, const string& user) { return ""; }  // TODO: "OK", "EXPIRED", "INVALID"

    int free(long long t) { return 0; }  // TODO: 空座数 / free seats

    string seat(long long t, int s) { return ""; }  // TODO: "FREE", "HELD <user>", "BOOKED <user>"
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
