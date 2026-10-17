import heapq
from collections import deque

MAX_FAILURES, LOCKOUT = 5, 30


class CodeGenerator:
    """取件码生成器 / Pickup codes from a fixed LCG, so the judge can replay them (production: a CSPRNG)."""

    def __init__(self, seed):
        self.x = seed

    def next(self):
        self.x = (self.x * 1103515245 + 12345) % 2147483648
        return f"{self.x % 1000000:06d}"


class Parcel:
    def __init__(self, pkg, compartment, deadline):
        self.pkg, self.compartment, self.deadline = pkg, compartment, deadline


class LockerStation:
    """快递柜 / Locker station: free compartments by size, parcels by code, expiry and a keypad lockout."""

    def __init__(self, counts: list, keep: int, seed: int):
        self.keep = keep
        self.codes = CodeGenerator(seed)
        self.free_by_size, first = [], 1
        for n in counts:
            self.free_by_size.append(list(range(first, first + n)))  # ascending: already a heap
            first += n
        self.size_of = [size for size, n in enumerate(counts) for _ in range(n)]
        self.by_code = {}  # 有效的取件码 -> 包裹 / active code -> parcel
        self.queue = deque()  # (code, parcel) 按投递顺序 / in delivery order: also expiry order
        self.returned = []  # 超期待退回 / expired, waiting for the returns courier
        self.failures, self.locked_until = 0, -1

    def _expire(self, t):
        while self.queue and self.queue[0][1].deadline <= t:
            code, parcel = self.queue.popleft()
            if self.by_code.get(code) is parcel:  # 还没被取走 / not picked up yet
                del self.by_code[code]
                self._release(parcel.compartment)
                self.returned.append(parcel.pkg)

    def _release(self, compartment):
        heapq.heappush(self.free_by_size[self.size_of[compartment - 1]], compartment)

    def deliver(self, t: int, pkg: str, size: int) -> str:
        self._expire(t)
        for s in range(size, 3):  # 能装下的最小尺寸 / the smallest size that fits
            if self.free_by_size[s]:
                compartment = heapq.heappop(self.free_by_size[s])
                break
        else:
            return "FULL"
        code = self.codes.next()
        while code in self.by_code:  # 和有效的码重复就重抽 / never reuse an active code
            code = self.codes.next()
        parcel = Parcel(pkg, compartment, t + self.keep)
        self.by_code[code] = parcel
        self.queue.append((code, parcel))
        return f"{compartment} {code}"

    def pickup(self, t: int, code: str) -> str:
        self._expire(t)
        if t < self.locked_until:
            return "LOCKED"
        parcel = self.by_code.pop(code, None)
        if parcel is None:
            self.failures += 1
            if self.failures == MAX_FAILURES:  # 连续输错：锁键盘 / too many wrong codes: lock the keypad
                self.failures, self.locked_until = 0, t + LOCKOUT
            return "INVALID"
        self.failures = 0
        self._release(parcel.compartment)
        return f"{parcel.pkg} {parcel.compartment}"

    def returns(self, t: int) -> str:
        self._expire(t)
        out, self.returned = self.returned, []
        return " ".join(out) or "NONE"

    def free(self, t: int, size: int) -> int:
        self._expire(t)
        return len(self.free_by_size[size])


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    counts = [int(next(it)) for _ in range(3)]
    keep = int(next(it))
    station = LockerStation(counts, keep, int(next(it)))
    sizes = {b"S": 0, b"M": 1, b"L": 2}
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        t = int(next(it))
        if op == b"deliver":
            pkg = next(it).decode()
            out.append(station.deliver(t, pkg, sizes[next(it)]))
        elif op == b"pickup":
            out.append(station.pickup(t, next(it).decode()))
        elif op == b"returns":
            out.append(station.returns(t))
        else:
            out.append(str(station.free(t, sizes[next(it)])))
    print("\n".join(out))


main()
