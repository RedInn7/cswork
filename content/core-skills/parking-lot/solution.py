import heapq


class SpotAllocator:
    """每种尺寸一个空位小根堆 / one min-heap of free spot ids per size."""

    def __init__(self, counts):
        self.free, first = [], 1
        for n in counts:
            self.free.append(list(range(first, first + n)))  # already a heap: ascending
            first += n
        self.size_of = [size for size, n in enumerate(counts) for _ in range(n)]

    def allocate(self, need):
        for size in range(need, 3):  # 先试刚好合适的尺寸，再往大了找 / smallest size that fits first
            if self.free[size]:
                return heapq.heappop(self.free[size])
        return None

    def release(self, spot):
        heapq.heappush(self.free[self.size_of[spot - 1]], spot)


class Ticket:
    def __init__(self, id, plate, spot, entry):
        self.id, self.plate, self.spot, self.entry = id, plate, spot, entry


class HourlyPricing:
    def __init__(self, rates):
        self.rates = rates

    def fee(self, size, minutes):
        return max(1, (minutes + 59) // 60) * self.rates[size]


class ParkingLot:
    """停车场 / Parking lot: tickets by id, plates parked, a spot allocator and a pricing rule."""

    def __init__(self, counts: list, rates: list):
        self.allocator = SpotAllocator(counts)
        self.pricing = HourlyPricing(rates)
        self.active = {}  # ticket id -> Ticket
        self.parked = set()  # plates in the lot
        self.next_id = 1

    def park(self, plate: str, size: int, t: int) -> str:
        if plate in self.parked:
            return "DUPLICATE"
        spot = self.allocator.allocate(size)
        if spot is None:
            return "FULL"
        ticket = Ticket(self.next_id, plate, spot, t)
        self.next_id += 1
        self.active[ticket.id] = ticket
        self.parked.add(plate)
        return f"{ticket.id} {spot}"

    def unpark(self, ticket_id: int, t: int) -> str:
        ticket = self.active.pop(ticket_id, None)  # 取出即作废，重复出场拿不到 / used once
        if ticket is None:
            return "INVALID"
        self.parked.discard(ticket.plate)
        self.allocator.release(ticket.spot)
        return str(self.pricing.fee(self.allocator.size_of[ticket.spot - 1], t - ticket.entry))

    def available(self, size: int) -> int:
        return len(self.allocator.free[size])


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
