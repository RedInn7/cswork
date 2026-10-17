class ATM:
    """ATM / Cash machine.

    建议用状态模式 / Suggested: the State pattern, IdleState, CardInsertedState, AuthenticatedState,
    每个状态只覆盖自己允许的操作，其余默认返回 "NOT_NOW" / each state overrides only what it allows.
    再拆出 / plus Account（PIN、余额、连续输错次数 / PIN, balance, wrong tries）and CashDispenser（配钞 / notes）.
    """

    def __init__(self, counts: list, accounts: dict):
        # counts: 10、50、100 面额的张数 / notes of 10, 50, 100; accounts[card] = (pin, balance)
        pass  # TODO

    def insert(self, card: str) -> str:
        return ""  # TODO: "OK", "UNKNOWN_CARD", "CARD_LOCKED", "NOT_NOW"

    def pin(self, pin: str) -> str:
        return ""  # TODO: "OK", "WRONG_PIN <left>", "LOCKED", "NOT_NOW"

    def balance(self) -> str:
        return ""  # TODO: 余额 / the balance, or "NOT_NOW"

    def withdraw(self, amount: int) -> str:
        return ""  # TODO: "100x1 10x2", "BAD_AMOUNT", "OVER_LIMIT", "INSUFFICIENT_FUNDS", "NO_NOTES", "NOT_NOW"

    def eject(self) -> str:
        return ""  # TODO: "OK" 或 / or "NOT_NOW"

    def cash(self) -> str:
        return ""  # TODO: 10、50、100 面额各剩几张 / notes of 10, 50, 100 left


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    counts = [int(next(it)) for _ in range(3)]
    accounts = {}
    for _ in range(int(next(it))):
        card = next(it).decode()
        pin = next(it).decode()
        accounts[card] = (pin, int(next(it)))
    atm = ATM(counts, accounts)
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"insert":
            out.append(atm.insert(next(it).decode()))
        elif op == b"pin":
            out.append(atm.pin(next(it).decode()))
        elif op == b"balance":
            out.append(atm.balance())
        elif op == b"withdraw":
            out.append(atm.withdraw(int(next(it))))
        elif op == b"eject":
            out.append(atm.eject())
        else:
            out.append(atm.cash())
    print("\n".join(out))


main()
