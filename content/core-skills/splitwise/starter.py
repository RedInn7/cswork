class Group:
    """一组人的账本 / A group's ledger.

    建议拆出 / Suggested: 三种分账规则（策略） / three split rules (strategies), EQUAL, EXACT and PERCENT,
    each turning an amount into cents owed per participant; 只存每人的净额 / keep net balances only.
    """

    def __init__(self):
        pass  # TODO

    def add_expense(self, payer: str, amount: int, kind: str, people: list, values: list) -> str:
        # kind: "EQUAL"（values 为空 / values empty）, "EXACT"（金额 / cents）, "PERCENT"（万分比 / basis points）
        return ""  # TODO: 各人份额 / each share in order, 或 / or "INVALID"

    def pay(self, frm: str, to: str, amount: int) -> str:
        return ""  # TODO: "OK"

    def balance(self, user: str) -> int:
        return 0  # TODO: 净额，> 0 别人欠他 / net, > 0 means owed money

    def settle(self) -> str:
        return ""  # TODO: "<count> <from> <to> <amount> ..."


# —— 以下驱动代码请勿修改 / Driver code below: do not modify ——
import sys


def main():
    it = iter(sys.stdin.buffer.read().split())
    group = Group()
    out = []
    for _ in range(int(next(it))):
        op = next(it)
        if op == b"expense":
            payer = next(it).decode()
            amount = int(next(it))
            kind = next(it).decode()
            people, values = [], []
            for _ in range(int(next(it))):
                people.append(next(it).decode())
                if kind != "EQUAL":
                    values.append(int(next(it)))
            out.append(group.add_expense(payer, amount, kind, people, values))
        elif op == b"pay":
            frm = next(it).decode()
            to = next(it).decode()
            out.append(group.pay(frm, to, int(next(it))))
        elif op == b"balance":
            out.append(str(group.balance(next(it).decode())))
        else:
            out.append(group.settle())
    print("\n".join(out))


main()
