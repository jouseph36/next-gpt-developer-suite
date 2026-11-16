"""Declarative agent specification validation."""
from dataclasses import dataclass
from .security import safe_name

@dataclass(frozen=True)
class AgentSpec:
    name: str
    purpose: str
    tools: tuple[str, ...] = ()
    requires_approval_for_writes: bool = True

    def validate(self) -> None:
        safe_name(self.name)
        if not self.purpose.strip():
            raise ValueError("Agent purpose is required")
        if not self.requires_approval_for_writes:
            raise ValueError("Write approval must be enabled in this starter")
        if len(set(self.tools)) != len(self.tools):
            raise ValueError("Duplicate tool names")
