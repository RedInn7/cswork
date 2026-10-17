COINS = (500, 100, 50, 10)  # 从大到小 / largest first; each divides the next larger one
IDLE, HAS_MONEY, OUT_OF_SERVICE = "IDLE", "HAS_MONEY", "OUT_OF_SERVICE"


class Slot:
    def __init__(self, price, count):
        self.price, self.count = price, count


def make_change(amount, pool):
    """贪心找零 / Greedy change from a limited pool: largest coin first, as many as there are.

    With 10 | 50 | 100 | 500 greedy finds change whenever any exists, with the fewest coins. None: impossible."""
    change = []
    for coin in COINS:
        take = min(pool.get(coin, 0), amount // coin)
        change += [coin] * take
        amount -= take * coin
    return change if amount == 0 else None


class VendingMachine:
    """售货机 / Vending machine: a state, slots, the cash box and the customer's escrow."""

    def __init__(self, cash: dict):
        self.cash = dict(cash)  # 机器自己的硬币 / coins the machine owns
        self.escrow = []  # 当前顾客投入的硬币 / the current customer's coins
        self.slots = {}
        self.state = IDLE

    def insert(self, coin: int) -> str:
        if self.state == OUT_OF_SERVICE:
            return "NOT_NOW"
        if coin not in COINS:
            return "REJECTED"
        self.escrow.append(coin)
        self.state = HAS_MONEY
        return str(sum(self.escrow))

    def select(self, code: str) -> str:
        if self.state != HAS_MONEY:
            return "NOT_NOW"
        slot = self.slots.get(code)
        if slot is None or slot.count == 0:
            return "SOLD_OUT"
        paid = sum(self.escrow)
        if paid < slot.price:
            return f"INSUFFICIENT {slot.price - paid}"
        pool = dict(self.cash)
        for coin in self.escrow:  # 投入的硬币也能找出去 / inserted coins can go back out as change
            pool[coin] = pool.get(coin, 0) + 1
        change = make_change(paid - slot.price, pool)
        if change is None:
            return "NO_CHANGE"  # 押金原封不动 / escrow untouched: cancel still refunds
        for coin in change:  # 一次提交 / commit in one step
            pool[coin] -= 1
        self.cash, self.escrow = pool, []
        slot.count -= 1
        self.state = IDLE
        return " ".join([code] + [str(c) for c in change])

    def cancel(self) -> str:
        if self.state != HAS_MONEY:
            return "NOT_NOW"
        coins, self.escrow = self.escrow, []
        self.state = IDLE
        return " ".join(map(str, coins))  # 原样退回 / the very coins inserted

    def service(self) -> str:
        if self.state != IDLE:
            return "NOT_NOW"
        self.state = OUT_OF_SERVICE
        return "OK"

    def restock(self, code: str, price: int, count: int) -> str:
        if self.state != OUT_OF_SERVICE:
            return "NOT_NOW"
        slot = self.slots.setdefault(code, Slot(price, 0))
        slot.price = price
        slot.count += count
        return "OK"

    def resume(self) -> str:
        if self.state != OUT_OF_SERVICE:
            return "NOT_NOW"
        self.state = IDLE
        return "OK"

    def cash_box(self) -> str:
        return " ".join(str(self.cash.get(coin, 0)) for coin in (10, 50, 100, 500))


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    machine = VendingMachine({coin: int(next(it)) for coin in (10, 50, 100, 500)})
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"insert":
            out.append(machine.insert(int(next(it))))
        elif op == b"select":
            out.append(machine.select(next(it).decode()))
        elif op == b"cancel":
            out.append(machine.cancel())
        elif op == b"service":
            out.append(machine.service())
        elif op == b"restock":
            code = next(it).decode()
            price = int(next(it))
            out.append(machine.restock(code, price, int(next(it))))
        elif op == b"resume":
            out.append(machine.resume())
        else:
            out.append(machine.cash_box())
    print("\n".join(out))


main()
