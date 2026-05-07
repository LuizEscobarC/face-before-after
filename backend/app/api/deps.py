from __future__ import annotations

from functools import lru_cache

from app.infra.storage import MinIOStorage


@lru_cache(maxsize=1)
def get_storage() -> MinIOStorage | None:
    try:
        storage = MinIOStorage()
        storage.ensure_bucket()
        return storage
    except Exception:
        return None
