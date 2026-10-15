"""Reference ledger: every level. Tests only; never shipped to learners."""
from __future__ import annotations

import heapq
from bisect import bisect_right


class Account:
    def __init__(self, opened: int) -> None:
        self.balance = 0
        self.outgoing = 0
        # (time, balance after that time's changes), in time order.
        self.history: list[tuple[int, int]] = [(opened, 0)]
        self.closed_at: int | None = None

    def record(self, time: int) -> None:
        if self.history[-1][0] == time:
            self.history[-1] = (time, self.balance)
        else:
            self.history.append((time, self.balance))


class Ledger:
    def __init__(self) -> None:
        self.accounts: dict[str, Account] = {}
        self.merged: dict[str, Account] = {}
        self.transfers: dict[str, dict] = {}
        self.queue: list[tuple[int, int, str]] = []
        self.count = 0

    def _due(self, now: int) -> None:
        while self.queue and self.queue[0][0] <= now:
            due, _, transfer_id = heapq.heappop(self.queue)
            item = self.transfers[transfer_id]
            if item['state'] != 'pending':
                continue
            source, target = self.accounts[item['source']], self.accounts[item['target']]
            if source.balance < item['amount']:
                item['state'] = 'failed'
                continue
            item['state'] = 'done'
            source.balance -= item['amount']
            source.outgoing += item['amount']
            target.balance += item['amount']
            source.record(due)
            target.record(due)

    def open_account(self, timestamp: int, account_id: str) -> bool:
        self._due(timestamp)
        if account_id in self.accounts or account_id in self.merged:
            return False
        self.accounts[account_id] = Account(timestamp)
        return True

    def deposit(self, timestamp: int, account_id: str, amount: int) -> int | None:
        self._due(timestamp)
        account = self.accounts.get(account_id)
        if account is None:
            return None
        account.balance += amount
        account.record(timestamp)
        return account.balance

    def withdraw(self, timestamp: int, account_id: str, amount: int) -> int | None:
        self._due(timestamp)
        account = self.accounts.get(account_id)
        if account is None or account.balance < amount:
            return None
        account.balance -= amount
        account.outgoing += amount
        account.record(timestamp)
        return account.balance

    def transfer(self, timestamp: int, source_id: str, target_id: str, amount: int) -> int | None:
        self._due(timestamp)
        source, target = self.accounts.get(source_id), self.accounts.get(target_id)
        if source is None or target is None or source_id == target_id or source.balance < amount:
            return None
        source.balance -= amount
        source.outgoing += amount
        target.balance += amount
        source.record(timestamp)
        target.record(timestamp)
        return source.balance

    def top_outgoing(self, timestamp: int, n: int) -> list[str]:
        self._due(timestamp)
        ranked = sorted(self.accounts.items(), key=lambda item: (-item[1].outgoing, item[0]))
        return [f'{account_id}({account.outgoing})' for account_id, account in ranked[:n]]

    def schedule_transfer(self, timestamp: int, source_id: str, target_id: str, amount: int, delay: int) -> str | None:
        self._due(timestamp)
        if source_id == target_id or source_id not in self.accounts or target_id not in self.accounts:
            return None
        self.count += 1
        transfer_id = f'transfer{self.count}'
        self.transfers[transfer_id] = {'source': source_id, 'target': target_id, 'amount': amount, 'state': 'pending'}
        heapq.heappush(self.queue, (timestamp + delay, self.count, transfer_id))
        return transfer_id

    def cancel_scheduled(self, timestamp: int, source_id: str, transfer_id: str) -> bool:
        self._due(timestamp)
        item = self.transfers.get(transfer_id)
        if item is None or item['state'] != 'pending' or item['source'] != source_id:
            return False
        item['state'] = 'cancelled'
        return True

    def merge(self, timestamp: int, keep_id: str, absorb_id: str) -> bool:
        self._due(timestamp)
        keep, absorb = self.accounts.get(keep_id), self.accounts.get(absorb_id)
        if keep is None or absorb is None or keep_id == absorb_id:
            return False
        keep.balance += absorb.balance
        keep.outgoing += absorb.outgoing
        keep.record(timestamp)
        absorb.closed_at = timestamp
        self.merged[absorb_id] = self.accounts.pop(absorb_id)
        for item in self.transfers.values():
            if item['state'] != 'pending':
                continue
            if item['source'] == absorb_id:
                item['source'] = keep_id
            if item['target'] == absorb_id:
                item['target'] = keep_id
            if item['source'] == item['target']:
                item['state'] = 'cancelled'
        return True

    def balance_at(self, timestamp: int, account_id: str, time_at: int) -> int | None:
        self._due(timestamp)
        account = self.accounts.get(account_id) or self.merged.get(account_id)
        if account is None or time_at < account.history[0][0]:
            return None
        if account.closed_at is not None and time_at >= account.closed_at:
            return None
        return account.history[bisect_right(account.history, (time_at, float('inf'))) - 1][1]
