"""Deterministic offline evaluation of exact-match fixtures."""
import json
from pathlib import Path

def run_cases(path: str) -> dict:
    cases = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(cases, list):
        raise ValueError("Evaluation fixture must be a JSON list")
    results = []
    for i, case in enumerate(cases):
        if not isinstance(case, dict) or not {"id", "expected", "actual"} <= case.keys():
            raise ValueError(f"Invalid case at index {i}")
        passed = case["actual"] == case["expected"]
        results.append({"id": str(case["id"]), "passed": passed})
    return {"total": len(results), "passed": sum(x["passed"] for x in results), "results": results}
