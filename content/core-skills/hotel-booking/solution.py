MAX_NIGHTS, DAYS = 30, 100000


class RoomType:
    def __init__(self, count, base, weekend):
        self.count, self.base, self.weekend = count, base, weekend
        self.booked = [0] * DAYS  # 每晚已订出的间数 / rooms taken per night


class WeekendPricing:
    """周五、周六晚用周末价 / Friday and Saturday nights at the weekend rate (day 0 is a Monday)."""

    def rate(self, room, night):
        return room.weekend if night % 7 in (4, 5) else room.base


class Reservation:
    def __init__(self, id, room, check_in, check_out):
        self.id, self.room, self.check_in, self.check_out = id, room, check_in, check_out
        self.active = True


class Hotel:
    """酒店预订 / Hotel booking: inventory counted per room type and night."""

    def __init__(self, types: dict):
        self.types = {name: RoomType(*spec) for name, spec in types.items()}
        self.pricing = WeekendPricing()
        self.reservations = {}

    def book(self, kind: str, check_in: int, check_out: int) -> str:
        if not 0 < check_out - check_in <= MAX_NIGHTS:
            return "INVALID"
        room = self.types[kind]
        nights = range(check_in, check_out)
        if any(room.booked[d] >= room.count for d in nights):  # 每一晚都要有空房 / every night must have a room
            return "FULL"
        for d in nights:
            room.booked[d] += 1
        reservation = Reservation(len(self.reservations) + 1, room, check_in, check_out)
        self.reservations[reservation.id] = reservation
        return f"{reservation.id} {sum(self.pricing.rate(room, d) for d in nights)}"

    def cancel(self, day: int, reservation_id: int) -> str:
        reservation = self.reservations.get(reservation_id)
        if reservation is None or not reservation.active:
            return "INVALID"
        if day >= reservation.check_in:
            return "TOO_LATE"
        reservation.active = False
        for d in range(reservation.check_in, reservation.check_out):
            reservation.room.booked[d] -= 1
        return "OK"

    def free(self, kind: str, night: int) -> int:
        room = self.types[kind]
        return room.count - room.booked[night]


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    types = {}
    for _ in range(int(next(it))):
        name = next(it).decode()
        types[name] = tuple(int(next(it)) for _ in range(3))
    hotel = Hotel(types)
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"book":
            kind = next(it).decode()
            check_in = int(next(it))
            out.append(hotel.book(kind, check_in, int(next(it))))
        elif op == b"cancel":
            day = int(next(it))
            out.append(hotel.cancel(day, int(next(it))))
        else:
            kind = next(it).decode()
            out.append(str(hotel.free(kind, int(next(it)))))
    print("\n".join(out))


main()
