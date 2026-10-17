#include <iostream>
#include <map>
#include <string>
#include <vector>
using namespace std;

// 酒店预订 / Hotel booking.
// 建议拆出 / Suggested: RoomType（间数、价格、每晚已订出几间 / count, rates, rooms taken per night）,
// Reservation（预订：房型、入住、退房、是否有效 / type, check-in, check-out, active）,
// WeekendPricing（价格规则 / the pricing rule）. 第 0 天是周一 / day 0 is a Monday.
class Hotel {
public:
    Hotel(const map<string, vector<long long>>& specs) {}  // TODO: specs[name] = {count, base, weekend}

    string book(const string& kind, int checkIn, int checkOut) { return ""; }  // TODO: "<id> <price>", "FULL", "INVALID"

    string cancel(int day, long long id) { return ""; }  // TODO: "OK", "TOO_LATE", "INVALID"

    int free(const string& kind, int night) { return 0; }  // TODO: 这一晚该房型的空房数 / free rooms that night
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
