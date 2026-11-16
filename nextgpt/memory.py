"""Local project notes, never synchronized automatically."""
import json
import os
import tempfile
from pathlib import Path

class ProjectMemory:
    def __init__(self, path: str = ".nextgpt/memory.json"):
        self.path = Path(path)

    def read(self) -> dict:
        if not self.path.exists():
            return {}
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Memory must contain a JSON object")
        return value

    def set(self, key: str, value: str) -> None:
        if not key or not isinstance(value, str):
            raise ValueError("Nonempty key and string value required")
        data = self.read()
        data[key] = value
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=self.path.parent, prefix=".memory-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            os.chmod(temp, 0o600)
            os.replace(temp, self.path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
