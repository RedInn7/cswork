class Show:
    """一场电影的座位 / One show's seats.

    建议拆出 / Suggested: Hold（锁座：用户、座位、过期时刻、状态 / user, seats, expiry, status）;
    每个座位记住占着它的锁座 / each seat remembers the hold that has it; 到期的锁座在每个操作开始时释放
    / release expired holds at the start of every operation.
    """

    def __init__(self, seats: int, ttl: int):
        pass  # TODO: 座位编号 1..seats，锁座 ttl 后过期 / seats 1..seats; a hold expires ttl after it is made

    def hold(self, t: int, user: str, seats: list) -> str:
        return ""  # TODO: 锁座编号 / the hold id, "TOO_MANY" 或 / or "UNAVAILABLE <seat>"

    def confirm(self, t: int, hold_id: int, user: str) -> str:
        return ""  # TODO: "OK", "EXPIRED" 或 / or "INVALID"

    def release(self, t: int, hold_id: int, user: str) -> str:
        return ""  # TODO: "OK", "EXPIRED" 或 / or "INVALID"

    def free(self, t: int) -> int:
        return 0  # TODO: 空座数 / free seats

    def seat(self, t: int, s: int) -> str:
        return ""  # TODO: "FREE", "HELD <user>" 或 / or "BOOKED <user>"


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
