import heapq
from collections import defaultdict


def split_equal(amount, people):
    base, extra = divmod(amount, len(people))
    return [base + (1 if i < extra else 0) for i in range(len(people))]


def split_exact(amount, amounts):
    return list(amounts) if sum(amounts) == amount else None


def split_percent(amount, basis_points):
    """万分比，向下取整，剩下的分按余数从大到小补，余数相同按列出顺序 / round down, leftover cents by remainder."""
    if sum(basis_points) != 10000:
        return None
    shares = [amount * bp // 10000 for bp in basis_points]
    left = amount - sum(shares)
    order = sorted(range(len(shares)), key=lambda i: (-(amount * basis_points[i] % 10000), i))
    for i in order[:left]:
        shares[i] += 1
    return shares


SPLITS = {"EQUAL": lambda amount, people, values: split_equal(amount, people),
          "EXACT": lambda amount, people, values: split_exact(amount, values),
          "PERCENT": lambda amount, people, values: split_percent(amount, values)}


class Group:
    """一组人的账本 / A group's ledger: net balances, > 0 is owed money, < 0 owes."""

    def __init__(self):
        self.net = defaultdict(int)

    def add_expense(self, payer: str, amount: int, kind: str, people: list, values: list) -> str:
        shares = SPLITS[kind](amount, people, values)
        if shares is None:
            return "INVALID"
        self.net[payer] += amount
        for person, share in zip(people, shares):
            self.net[person] -= share
        return " ".join(map(str, shares))

    def pay(self, frm: str, to: str, amount: int) -> str:
        self.net[frm] += amount
        self.net[to] -= amount
        return "OK"

    def balance(self, user: str) -> int:
        return self.net.get(user, 0)

    def settle(self) -> str:
        """最大债务人付给最大债权人，金额相同按名字 / Largest debtor pays largest creditor; ties by name."""
        debtors = [(v, u) for u, v in self.net.items() if v < 0]  # (-debt, name)
        creditors = [(-v, u) for u, v in self.net.items() if v > 0]  # (-credit, name)
        heapq.heapify(debtors)
        heapq.heapify(creditors)
        transfers = []
        while debtors and creditors:
            d, du = heapq.heappop(debtors)
            c, cu = heapq.heappop(creditors)
            pay = min(-d, -c)
            transfers.append(f"{du} {cu} {pay}")
            if -d > pay:
                heapq.heappush(debtors, (d + pay, du))
            if -c > pay:
                heapq.heappush(creditors, (c + pay, cu))
        return " ".join([str(len(transfers))] + transfers)


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
