NOTES = (100, 50, 10)  # 从大到小 / largest first; each divides the next larger one
LIMIT = 2000  # 单笔上限 / per-withdrawal limit
MAX_TRIES = 3


class Account:
    def __init__(self, pin, balance):
        self.pin, self.balance = pin, balance
        self.failures = 0  # 连续输错 PIN 的次数 / consecutive wrong PINs
        self.locked = False


class CashDispenser:
    def __init__(self, counts):
        self.counts = dict(zip((10, 50, 100), counts))

    def plan(self, amount):
        """贪心配钞 / Greedy notes, largest first; None when the cassettes cannot pay exactly."""
        notes = {}
        for note in NOTES:
            take = min(self.counts[note], amount // note)
            notes[note] = take
            amount -= take * note
        return notes if amount == 0 else None

    def dispense(self, notes):
        for note, n in notes.items():
            self.counts[note] -= n


class State:
    """状态接口：默认都是“现在不行” / The state interface: every action defaults to "not now"."""

    def insert(self, atm, card):
        return "NOT_NOW"

    def pin(self, atm, pin):
        return "NOT_NOW"

    def balance(self, atm):
        return "NOT_NOW"

    def withdraw(self, atm, amount):
        return "NOT_NOW"

    def eject(self, atm):
        return "NOT_NOW"


class IdleState(State):
    def insert(self, atm, card):
        account = atm.accounts.get(card)
        if account is None:
            return "UNKNOWN_CARD"
        if account.locked:
            return "CARD_LOCKED"
        atm.account, atm.state = account, CARD_INSERTED
        return "OK"


class CardInsertedState(State):
    def pin(self, atm, pin):
        account = atm.account
        if pin == account.pin:
            account.failures = 0
            atm.state = AUTHENTICATED
            return "OK"
        account.failures += 1
        if account.failures == MAX_TRIES:
            account.locked = True  # 吞卡，结束会话 / keep the card, end the session
            atm.end_session()
            return "LOCKED"
        return f"WRONG_PIN {MAX_TRIES - account.failures}"

    def eject(self, atm):
        atm.end_session()
        return "OK"


class AuthenticatedState(CardInsertedState):
    def pin(self, atm, pin):
        return "NOT_NOW"

    def balance(self, atm):
        return str(atm.account.balance)

    def withdraw(self, atm, amount):
        if amount <= 0 or amount % 10:
            return "BAD_AMOUNT"
        if amount > LIMIT:
            return "OVER_LIMIT"
        if amount > atm.account.balance:
            return "INSUFFICIENT_FUNDS"
        notes = atm.dispenser.plan(amount)
        if notes is None:
            return "NO_NOTES"
        atm.account.balance -= amount  # 先确认能出钞，再扣款 / debit only once the notes are certain
        atm.dispenser.dispense(notes)
        return " ".join(f"{note}x{n}" for note, n in notes.items() if n)


IDLE, CARD_INSERTED, AUTHENTICATED = IdleState(), CardInsertedState(), AuthenticatedState()


class ATM:
    """ATM：门面，持有当前状态、会话里的账户和出钞机 / Facade: the current state, the session's account, the dispenser."""

    def __init__(self, counts: list, accounts: dict):
        self.dispenser = CashDispenser(counts)
        self.accounts = {card: Account(pin, balance) for card, (pin, balance) in accounts.items()}
        self.account = None
        self.state = IDLE

    def end_session(self):
        self.account, self.state = None, IDLE

    def insert(self, card: str) -> str:
        return self.state.insert(self, card)

    def pin(self, pin: str) -> str:
        return self.state.pin(self, pin)

    def balance(self) -> str:
        return self.state.balance(self)

    def withdraw(self, amount: int) -> str:
        return self.state.withdraw(self, amount)

    def eject(self) -> str:
        return self.state.eject(self)

    def cash(self) -> str:
        return " ".join(str(self.dispenser.counts[note]) for note in (10, 50, 100))


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
