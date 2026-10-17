class Hotel:
    """酒店预订 / Hotel booking.

    建议拆出 / Suggested: RoomType（间数、价格、每晚已订出几间 / count, rates, rooms taken per night）,
    Reservation（预订：房型、入住、退房、是否有效 / type, check-in, check-out, active）,
    WeekendPricing（价格规则 / the pricing rule）. 第 0 天是周一 / day 0 is a Monday.
    """

    def __init__(self, types: dict):
        pass  # TODO: types[name] = (count, base, weekend)

    def book(self, kind: str, check_in: int, check_out: int) -> str:
        return ""  # TODO: "<id> <price>", "FULL" 或 / or "INVALID"

    def cancel(self, day: int, reservation_id: int) -> str:
        return ""  # TODO: "OK", "TOO_LATE" 或 / or "INVALID"

    def free(self, kind: str, night: int) -> int:
        return 0  # TODO: 这一晚该房型的空房数 / free rooms of that type that night


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
