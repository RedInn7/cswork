UP, DOWN, IDLE = "UP", "DOWN", "IDLE"


class Elevator:
    """电梯 / Elevator: one car, LOOK scheduling over two sets of stops."""

    def __init__(self, floors: int, start: int):
        self.floor = start
        self.dir = IDLE
        self.up_stops = set()  # 上行时要停的楼层 / floors to stop at while going up
        self.down_stops = set()  # 下行时要停的楼层 / floors to stop at while going down

    def call(self, floor: int, want: str) -> str:
        (self.up_stops if want == UP else self.down_stops).add(floor)
        return "OK"

    def press(self, floor: int) -> str:
        if floor > self.floor:
            self.up_stops.add(floor)
        elif floor < self.floor:
            self.down_stops.add(floor)
        else:
            return "OPEN"
        return "OK"

    def _work_above(self):
        return any(f > self.floor for f in self.up_stops) or any(f > self.floor for f in self.down_stops)

    def _work_below(self):
        return any(f < self.floor for f in self.up_stops) or any(f < self.floor for f in self.down_stops)

    def _take(self, stops):
        if self.floor in stops:
            stops.remove(self.floor)
            return True
        return False

    def step(self) -> str:
        if self.dir == UP and not self._work_above():
            self.dir = DOWN if self._work_below() else IDLE
        elif self.dir == DOWN and not self._work_below():
            self.dir = UP if self._work_above() else IDLE
        elif self.dir == IDLE:
            self.dir = UP if self._work_above() else DOWN if self._work_below() else IDLE
        if self.dir == IDLE:  # 别处没有任务：服务本层 / nothing elsewhere: serve this floor
            stop = self._take(self.up_stops) | self._take(self.down_stops)
        elif self._take(self.up_stops if self.dir == UP else self.down_stops):
            stop = True  # 本层有同方向的请求：开门，这一步不动 / a call here this way: open, stay
        else:
            self.floor += 1 if self.dir == UP else -1
            if self.dir == UP:
                stop = self._take(self.up_stops)
                if not self._work_above():  # 本趟的最高点：顺便接下行的人 / top of the sweep
                    stop |= self._take(self.down_stops)
            else:
                stop = self._take(self.down_stops)
                if not self._work_below():
                    stop |= self._take(self.up_stops)
        return f"{self.floor} {self.dir} {'OPEN' if stop else '-'}"

    def where(self) -> str:
        return f"{self.floor} {self.dir} {len(self.up_stops) + len(self.down_stops)}"


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
