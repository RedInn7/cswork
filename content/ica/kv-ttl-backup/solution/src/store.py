"""Reference store: every level. Tests only; never shipped to learners."""
from __future__ import annotations


class Store:
    def __init__(self) -> None:
        # key -> (value, expiry time or None)
        self.data: dict[str, tuple[str, int | None]] = {}
        # (backup time, key -> (value, remaining ttl or None)), in time order
        self.backups: list[tuple[int, dict[str, tuple[str, int | None]]]] = []

    def _live(self, now: int, key: str) -> tuple[str, int | None] | None:
        item = self.data.get(key)
        if item is not None and item[1] is not None and now >= item[1]:
            del self.data[key]
            return None
        return item

    def _keys(self, now: int, prefix: str = '') -> list[str]:
        return sorted(key for key in list(self.data) if key.startswith(prefix) and self._live(now, key))

    def put(self, timestamp: int, key: str, value: str) -> str | None:
        old = self._live(timestamp, key)
        self.data[key] = (value, None)
        return old[0] if old else None

    def get(self, timestamp: int, key: str) -> str | None:
        item = self._live(timestamp, key)
        return item[0] if item else None

    def delete(self, timestamp: int, key: str) -> bool:
        if not self._live(timestamp, key):
            return False
        del self.data[key]
        return True

    def scan(self, timestamp: int, prefix: str) -> list[str]:
        return [f'{key}={self.data[key][0]}' for key in self._keys(timestamp, prefix)]

    def count(self, timestamp: int, prefix: str) -> int:
        return len(self._keys(timestamp, prefix))

    def put_ttl(self, timestamp: int, key: str, value: str, ttl: int) -> str | None:
        old = self._live(timestamp, key)
        self.data[key] = (value, timestamp + ttl)
        return old[0] if old else None

    def ttl_left(self, timestamp: int, key: str) -> int | None:
        item = self._live(timestamp, key)
        if item is None:
            return None
        return -1 if item[1] is None else item[1] - timestamp

    def backup(self, timestamp: int) -> int:
        snapshot = {}
        for key in self._keys(timestamp):
            value, expiry = self.data[key]
            snapshot[key] = (value, None if expiry is None else expiry - timestamp)
        self.backups.append((timestamp, snapshot))
        return len(snapshot)

    def restore(self, timestamp: int, backup_time: int) -> bool:
        chosen = None
        for taken, snapshot in self.backups:
            if taken <= backup_time:
                chosen = snapshot
        if chosen is None:
            return False
        self.data = {key: (value, None if left is None else timestamp + left) for key, (value, left) in chosen.items()}
        return True
