"""A key-value store, built level by level: read the brief of the level you are on."""
from __future__ import annotations


class Store:
    def __init__(self) -> None:
        pass

    # Level 1
    def put(self, timestamp: int, key: str, value: str) -> str | None:
        raise NotImplementedError

    def get(self, timestamp: int, key: str) -> str | None:
        raise NotImplementedError

    def delete(self, timestamp: int, key: str) -> bool:
        raise NotImplementedError

    # Level 2
    def scan(self, timestamp: int, prefix: str) -> list[str]:
        raise NotImplementedError

    def count(self, timestamp: int, prefix: str) -> int:
        raise NotImplementedError

    # Level 3
    def put_ttl(self, timestamp: int, key: str, value: str, ttl: int) -> str | None:
        raise NotImplementedError

    def ttl_left(self, timestamp: int, key: str) -> int | None:
        raise NotImplementedError

    # Level 4
    def backup(self, timestamp: int) -> int:
        raise NotImplementedError

    def restore(self, timestamp: int, backup_time: int) -> bool:
        raise NotImplementedError
