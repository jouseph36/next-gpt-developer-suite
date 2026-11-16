"""Small offline security helpers. Not a replacement for dedicated scanners."""
import re
from pathlib import Path

_PATTERNS = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github_token": re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
    "openai_key": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
}

def find_possible_secrets(text: str) -> list[str]:
    """Return labels, never secret values."""
    return [name for name, pattern in _PATTERNS.items() if pattern.search(text)]

def safe_name(name: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,62}", name):
        raise ValueError("Name must be 2-63 lowercase letters, digits or hyphens; start with a letter")
    return name

def safe_child(root: Path, name: str) -> Path:
    safe_name(name)
    root = root.resolve()
    child = (root / name).resolve()
    if child.parent != root:
        raise ValueError("Invalid output location")
    return child
