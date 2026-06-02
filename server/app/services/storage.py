from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import BinaryIO, Optional

from ..core.config import get_settings


def storage_root() -> Path:
    s = get_settings()
    root = Path(s.upload_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_file(family_id: str, fileobj: BinaryIO, original_name: str) -> tuple[str, int]:
    ext = os.path.splitext(original_name)[1].lower()
    name = f"{uuid.uuid4().hex}{ext}"
    rel = Path(family_id) / name
    full = storage_root() / rel
    full.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    with open(full, "wb") as out:
        while True:
            chunk = fileobj.read(1 << 16)
            if not chunk:
                break
            size += len(chunk)
            out.write(chunk)
    return str(rel), size


def delete_file(rel_path: Optional[str]) -> None:
    if not rel_path:
        return
    full = storage_root() / rel_path
    try:
        full.unlink(missing_ok=True)
    except OSError:
        pass
