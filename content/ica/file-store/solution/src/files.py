"""Reference file store: every level. Tests only; never shipped to learners."""
from __future__ import annotations

ADMIN = 'admin'


class FileStore:
    def __init__(self) -> None:
        self.files: dict[str, tuple[int, str]] = {}  # path -> (size, owner)
        self.quotas: dict[str, int] = {}
        self.backups: dict[str, list[tuple[str, int]]] = {}

    def _left(self, user_id: str) -> int:
        return self.quotas[user_id] - sum(size for size, owner in self.files.values() if owner == user_id)

    def add(self, timestamp: int, path: str, size: int) -> bool:
        if path in self.files:
            return False
        self.files[path] = (size, ADMIN)
        return True

    def size_of(self, timestamp: int, path: str) -> int | None:
        item = self.files.get(path)
        return item[0] if item else None

    def remove(self, timestamp: int, path: str) -> int | None:
        item = self.files.pop(path, None)
        return item[0] if item else None

    def largest(self, timestamp: int, prefix: str, n: int) -> list[str]:
        found = sorted((-size, path) for path, (size, _) in self.files.items() if path.startswith(prefix))
        return [f'{path}({-size})' for size, path in found[:n]]

    def total_size(self, timestamp: int, prefix: str) -> int:
        return sum(size for path, (size, _) in self.files.items() if path.startswith(prefix))

    def add_user(self, timestamp: int, user_id: str, quota: int) -> bool:
        if user_id == ADMIN or user_id in self.quotas:
            return False
        self.quotas[user_id] = quota
        return True

    def add_as(self, timestamp: int, user_id: str, path: str, size: int) -> int | None:
        if user_id not in self.quotas or path in self.files or size > self._left(user_id):
            return None
        self.files[path] = (size, user_id)
        return self._left(user_id)

    def remaining(self, timestamp: int, user_id: str) -> int | None:
        return self._left(user_id) if user_id in self.quotas else None

    def compress(self, timestamp: int, user_id: str, path: str) -> int | None:
        item = self.files.get(path)
        if (user_id not in self.quotas or item is None or item[1] != user_id
                or path.endswith('.z') or path + '.z' in self.files):
            return None
        del self.files[path]
        self.files[path + '.z'] = ((item[0] + 1) // 2, user_id)
        return self._left(user_id)

    def backup_user(self, timestamp: int, user_id: str) -> int | None:
        if user_id not in self.quotas:
            return None
        self.backups[user_id] = sorted((path, size) for path, (size, owner) in self.files.items() if owner == user_id)
        return len(self.backups[user_id])

    def restore_user(self, timestamp: int, user_id: str) -> int | None:
        if user_id not in self.quotas or user_id not in self.backups:
            return None
        self.files = {path: item for path, item in self.files.items() if item[1] != user_id}
        restored = 0
        for path, size in self.backups[user_id]:
            if path not in self.files:
                self.files[path] = (size, user_id)
                restored += 1
        return restored
