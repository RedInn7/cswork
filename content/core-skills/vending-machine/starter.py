class VendingMachine:
    """售货机 / Vending machine.

    状态 / states: IDLE, HAS_MONEY, OUT_OF_SERVICE. 收 / accepts 10, 50, 100, 500.
    建议拆出 / Suggested: Slot（价格和库存 / price and stock）, make_change（贪心找零 / greedy change）;
    顾客的硬币（押金）和机器的钱箱分开放 / keep the customer's escrow apart from the cash box.
    """

    def __init__(self, cash: dict):
        pass  # TODO: cash[coin] 是钱箱里该面值的硬币数 / coins of each value in the cash box

    def insert(self, coin: int) -> str:
        return ""  # TODO: 已投总额 / the escrow total, "REJECTED" 或 / or "NOT_NOW"

    def select(self, code: str) -> str:
        return ""  # TODO: "<code> <change...>", "SOLD_OUT", "INSUFFICIENT <n>", "NO_CHANGE", "NOT_NOW"

    def cancel(self) -> str:
        return ""  # TODO: 按投入顺序退回的硬币 / the coins back in the order inserted, or "NOT_NOW"

    def service(self) -> str:
        return ""  # TODO: "OK" 或 / or "NOT_NOW"

    def restock(self, code: str, price: int, count: int) -> str:
        return ""  # TODO: "OK" 或 / or "NOT_NOW"

    def resume(self) -> str:
        return ""  # TODO: "OK" 或 / or "NOT_NOW"

    def cash_box(self) -> str:
        return ""  # TODO: 钱箱里 10 50 100 500 各几枚 / coins of 10 50 100 500 in the cash box


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
