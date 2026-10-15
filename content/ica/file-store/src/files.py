"""A file store, built level by level: read the brief of the level you are on."""
from __future__ import annotations


class FileStore:
    def __init__(self) -> None:
        pass

    # Level 1
    def add(self, timestamp: int, path: str, size: int) -> bool:
        raise NotImplementedError

    def size_of(self, timestamp: int, path: str) -> int | None:
        raise NotImplementedError

    def remove(self, timestamp: int, path: str) -> int | None:
        raise NotImplementedError

    # Level 2
    def largest(self, timestamp: int, prefix: str, n: int) -> list[str]:
        raise NotImplementedError

    def total_size(self, timestamp: int, prefix: str) -> int:
        raise NotImplementedError

    # Level 3
    def add_user(self, timestamp: int, user_id: str, quota: int) -> bool:
        raise NotImplementedError

    def add_as(self, timestamp: int, user_id: str, path: str, size: int) -> int | None:
        raise NotImplementedError

    def remaining(self, timestamp: int, user_id: str) -> int | None:
        raise NotImplementedError

    # Level 4
    def compress(self, timestamp: int, user_id: str, path: str) -> int | None:
        raise NotImplementedError

    def backup_user(self, timestamp: int, user_id: str) -> int | None:
        raise NotImplementedError

    def restore_user(self, timestamp: int, user_id: str) -> int | None:
        raise NotImplementedError
