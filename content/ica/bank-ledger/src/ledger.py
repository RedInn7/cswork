"""A bank ledger, built level by level: read the brief of the level you are on."""
from __future__ import annotations


class Ledger:
    def __init__(self) -> None:
        pass

    # Level 1
    def open_account(self, timestamp: int, account_id: str) -> bool:
        raise NotImplementedError

    def deposit(self, timestamp: int, account_id: str, amount: int) -> int | None:
        raise NotImplementedError

    def withdraw(self, timestamp: int, account_id: str, amount: int) -> int | None:
        raise NotImplementedError

    def transfer(self, timestamp: int, source_id: str, target_id: str, amount: int) -> int | None:
        raise NotImplementedError

    # Level 2
    def top_outgoing(self, timestamp: int, n: int) -> list[str]:
        raise NotImplementedError

    # Level 3
    def schedule_transfer(self, timestamp: int, source_id: str, target_id: str, amount: int, delay: int) -> str | None:
        raise NotImplementedError

    def cancel_scheduled(self, timestamp: int, source_id: str, transfer_id: str) -> bool:
        raise NotImplementedError

    # Level 4
    def merge(self, timestamp: int, keep_id: str, absorb_id: str) -> bool:
        raise NotImplementedError

    def balance_at(self, timestamp: int, account_id: str, time_at: int) -> int | None:
        raise NotImplementedError
