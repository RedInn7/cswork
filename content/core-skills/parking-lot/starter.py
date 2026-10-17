class ParkingLot:
    """停车场 / Parking lot.

    建议拆出 / Suggested classes: SpotAllocator（每种尺寸一个空位堆 / a free-spot heap per size）,
    Ticket, HourlyPricing（计费策略 / the pricing strategy）.
    尺寸 size: 0 = S, 1 = M, 2 = L.
    """

    def __init__(self, counts: list, rates: list):
        # counts[size]: 该尺寸车位数 / spots of that size; rates[size]: 每小时价格 / price per hour
        pass  # TODO

    def park(self, plate: str, size: int, t: int) -> str:
        return ""  # TODO: "<ticket> <spot>", "FULL" 或 / or "DUPLICATE"

    def unpark(self, ticket_id: int, t: int) -> str:
        return ""  # TODO: 停车费 / the fee, 或 / or "INVALID"

    def available(self, size: int) -> int:
        return 0  # TODO: 该尺寸的空位数 / free spots of exactly that size


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    counts = [int(next(it)) for _ in range(3)]
    rates = [int(next(it)) for _ in range(3)]
    lot = ParkingLot(counts, rates)
    sizes = {b"S": 0, b"M": 1, b"L": 2}
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"park":
            plate = next(it).decode()
            size = sizes[next(it)]
            out.append(lot.park(plate, size, int(next(it))))
        elif op == b"unpark":
            ticket = int(next(it))
            out.append(lot.unpark(ticket, int(next(it))))
        else:
            out.append(str(lot.available(sizes[next(it)])))
    print("\n".join(out))


main()
