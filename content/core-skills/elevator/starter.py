class Elevator:
    """电梯 / Elevator: one car.

    建议用两个有序集合 / Suggested: two sets of floors, up_stops（上行时停 / stop while going up）
    and down_stops（下行时停 / stop while going down）. 方向 / directions: "UP", "DOWN", "IDLE".
    """

    def __init__(self, floors: int, start: int):
        pass  # TODO

    def call(self, floor: int, want: str) -> str:
        return ""  # TODO: 厅外按钮，want 是 "UP" 或 "DOWN" / a hall call; returns "OK"

    def press(self, floor: int) -> str:
        return ""  # TODO: 轿厢内按钮 / a car button: "OK", 或本层直接 / or at this floor "OPEN"

    def step(self) -> str:
        return ""  # TODO: "<floor> <dir> OPEN" 或 / or "<floor> <dir> -"

    def where(self) -> str:
        return ""  # TODO: "<floor> <dir> <pending stops>"


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    car = Elevator(int(next(it)), int(next(it)))
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"call":
            floor = int(next(it))
            out.append(car.call(floor, "UP" if next(it) == b"U" else "DOWN"))
        elif op == b"press":
            out.append(car.press(int(next(it))))
        elif op == b"step":
            out.append(car.step())
        else:
            out.append(car.where())
    print("\n".join(out))


main()
