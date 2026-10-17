class LockerStation:
    """快递柜 / Locker station.

    建议拆出 / Suggested: CodeGenerator（题面里的 LCG / the statement's LCG）, Parcel（包裹、格口、截止时刻 /
    package, compartment, deadline）; 每种尺寸一个空格口堆 / a free-compartment heap per size;
    取件码 -> 包裹的哈希表 / a hash map from code to parcel. 尺寸 size: 0 = S, 1 = M, 2 = L.
    """

    def __init__(self, counts: list, keep: int, seed: int):
        pass  # TODO

    def deliver(self, t: int, pkg: str, size: int) -> str:
        return ""  # TODO: "<compartment> <code>" 或 / or "FULL"

    def pickup(self, t: int, code: str) -> str:
        return ""  # TODO: "<pkg> <compartment>", "INVALID" 或 / or "LOCKED"

    def returns(self, t: int) -> str:
        return ""  # TODO: 待退回的包裹 / packages to return, 或 / or "NONE"

    def free(self, t: int, size: int) -> int:
        return 0  # TODO: 该尺寸的空格口数 / free compartments of exactly that size


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
