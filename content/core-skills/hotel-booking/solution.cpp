#include <iostream>
#include <map>
#include <string>
#include <vector>
using namespace std;

const int MAX_NIGHTS = 30, DAYS = 100000;

struct RoomType {
    int count;
    long long base, weekend;
    vector<int> booked = vector<int>(DAYS, 0);  // 每晚已订出的间数 / rooms taken per night
};

// 周五、周六晚用周末价 / Friday and Saturday nights at the weekend rate (day 0 is a Monday).
struct WeekendPricing {
    long long rate(const RoomType& room, int night) const {
        return night % 7 == 4 || night % 7 == 5 ? room.weekend : room.base;
    }
};

struct Reservation {
    RoomType* room;
    int checkIn, checkOut;
    bool active = true;
};

// 酒店预订 / Hotel booking: inventory counted per room type and night.
class Hotel {
    map<string, RoomType> types;
    WeekendPricing pricing;
    vector<Reservation> reservations;  // id - 1 -> reservation

public:
    Hotel(const map<string, vector<long long>>& specs) {
        for (auto& [name, spec] : specs) types[name] = RoomType{(int)spec[0], spec[1], spec[2]};
    }

    string book(const string& kind, int checkIn, int checkOut) {
        if (checkOut - checkIn <= 0 || checkOut - checkIn > MAX_NIGHTS) return "INVALID";
        RoomType& room = types[kind];
        for (int d = checkIn; d < checkOut; d++)  // 每一晚都要有空房 / every night must have a room
            if (room.booked[d] >= room.count) return "FULL";
        long long price = 0;
        for (int d = checkIn; d < checkOut; d++) {
            room.booked[d]++;
            price += pricing.rate(room, d);
        }
        reservations.push_back({&room, checkIn, checkOut});
        return to_string(reservations.size()) + " " + to_string(price);
    }

    string cancel(int day, long long id) {
        if (id < 1 || id > (long long)reservations.size() || !reservations[id - 1].active) return "INVALID";
        Reservation& r = reservations[id - 1];
        if (day >= r.checkIn) return "TOO_LATE";
        r.active = false;
        for (int d = r.checkIn; d < r.checkOut; d++) r.room->booked[d]--;
        return "OK";
    }

    int free(const string& kind, int night) {
        RoomType& room = types[kind];
        return room.count - room.booked[night];
    }
};

// —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t, q, a, b;
    long long id;
    string op, kind;
    cin >> t;
    map<string, vector<long long>> specs;
    while (t--) {
        vector<long long> spec(3);
        cin >> kind >> spec[0] >> spec[1] >> spec[2];
        specs[kind] = spec;
    }
    Hotel hotel(specs);
    cin >> q;
    while (q--) {
        cin >> op;
        if (op == "book") {
            cin >> kind >> a >> b;
            cout << hotel.book(kind, a, b) << '\n';
        } else if (op == "cancel") {
            cin >> a >> id;
            cout << hotel.cancel(a, id) << '\n';
        } else {
            cin >> kind >> a;
            cout << hotel.free(kind, a) << '\n';
        }
    }
}
