from collections import deque

MAX_SEATS = 10
ACTIVE, BOOKED, RELEASED, EXPIRED = "ACTIVE", "BOOKED", "RELEASED", "EXPIRED"


class Hold:
    def __init__(self, id, user, seats, expires):
        self.id, self.user, self.seats, self.expires = id, user, seats, expires
        self.status = ACTIVE


class Show:
    """一场电影的座位 / One show's seats: each seat points at the hold that has it, or 0 when free."""

    def __init__(self, seats: int, ttl: int):
        self.ttl = ttl
        self.owner = [0] * (seats + 1)  # seat -> hold id, 0: free
        self.holds = {}
        self.queue = deque()  # 按过期时间排好的锁座 / holds in expiry order (one TTL for all)
        self.free_count = seats

    def _expire(self, t):
        """到期的锁座自动释放 / Release every active hold whose time is up (expires <= t)."""
        while self.queue and self.queue[0].expires <= t:
            hold = self.queue.popleft()
            if hold.status == ACTIVE:
                hold.status = EXPIRED
                self._free(hold)

    def _free(self, hold):
        for s in hold.seats:
            self.owner[s] = 0
        self.free_count += len(hold.seats)

    def hold(self, t: int, user: str, seats: list) -> str:
        self._expire(t)
        if len(seats) > MAX_SEATS:
            return "TOO_MANY"
        for s in seats:  # 全有或全无 / all or nothing
            if self.owner[s]:
                return f"UNAVAILABLE {s}"
        hold = Hold(len(self.holds) + 1, user, seats, t + self.ttl)
        self.holds[hold.id] = hold
        self.queue.append(hold)
        for s in seats:
            self.owner[s] = hold.id
        self.free_count -= len(seats)
        return str(hold.id)

    def _finish(self, t, hold_id, user, status):
        self._expire(t)
        hold = self.holds.get(hold_id)
        if hold is None or hold.user != user:
            return "INVALID"
        if hold.status == EXPIRED:
            return "EXPIRED"
        if hold.status != ACTIVE:
            return "INVALID"
        hold.status = status
        if status == RELEASED:
            self._free(hold)
        return "OK"

    def confirm(self, t: int, hold_id: int, user: str) -> str:
        return self._finish(t, hold_id, user, BOOKED)

    def release(self, t: int, hold_id: int, user: str) -> str:
        return self._finish(t, hold_id, user, RELEASED)

    def free(self, t: int) -> int:
        self._expire(t)
        return self.free_count

    def seat(self, t: int, s: int) -> str:
        self._expire(t)
        hold = self.holds.get(self.owner[s])
        if hold is None:
            return "FREE"
        return f"{'BOOKED' if hold.status == BOOKED else 'HELD'} {hold.user}"


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    seats = int(next(it))
    show = Show(seats, int(next(it)))
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        t = int(next(it))
        if op == b"hold":
            user = next(it).decode()
            chosen = [int(next(it)) for _ in range(int(next(it)))]
            out.append(show.hold(t, user, chosen))
        elif op == b"confirm" or op == b"release":
            hold_id = int(next(it))
            user = next(it).decode()
            out.append(show.confirm(t, hold_id, user) if op == b"confirm" else show.release(t, hold_id, user))
        elif op == b"free":
            out.append(str(show.free(t)))
        else:
            out.append(show.seat(t, int(next(it))))
    print("\n".join(out))


main()
