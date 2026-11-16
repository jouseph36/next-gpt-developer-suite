"""Generate minimal safe plugin/agent scaffolds."""
import json
from pathlib import Path
from .security import safe_child

def scaffold(name: str, output: str = "./generated") -> Path:
    root = Path(output).expanduser().resolve()
    target = safe_child(root, name)
    if target.exists():
        raise FileExistsError(f"Refusing to overwrite {target}")
    root.mkdir(parents=True, exist_ok=True)
    target.mkdir()
    spec = {
        "name": name,
        "purpose": "Describe what this agent does",
        "tools": [],
        "requires_approval_for_writes": True,
        "external_network_enabled": False,
    }
    (target / "agent.json").write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    (target / "INSTRUCTIONS.md").write_text(
        "# Agent instructions\n\nDefine scope, tools, trust boundaries and evaluation cases.\n"
        "\nNever expose credentials or perform write actions without approval.\n",
        encoding="utf-8",
    )
    return target
