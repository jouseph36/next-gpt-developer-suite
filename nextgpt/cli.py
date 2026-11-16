"""CLI entry point; all commands run offline."""
import argparse
import json
import sys
from . import __version__
from .evaluation import run_cases
from .factory import scaffold
from .security import find_possible_secrets

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="nextgpt")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="Print local environment information")
    make = commands.add_parser("scaffold", help="Create a starter agent")
    make.add_argument("name")
    make.add_argument("--output", default="./generated")
    ev = commands.add_parser("eval", help="Evaluate offline JSON fixtures")
    ev.add_argument("file")
    scan = commands.add_parser("scan", help="Scan a local text file for possible secrets")
    scan.add_argument("file")
    args = parser.parse_args(argv)
    try:
        if args.command == "doctor":
            print(json.dumps({"version": __version__, "python": sys.version.split()[0], "network_required": False}))
        elif args.command == "scaffold":
            print(scaffold(args.name, args.output))
        elif args.command == "eval":
            report = run_cases(args.file)
            print(json.dumps(report, indent=2))
            return 0 if report["passed"] == report["total"] else 1
        elif args.command == "scan":
            with open(args.file, encoding="utf-8") as handle:
                labels = find_possible_secrets(handle.read())
            print(json.dumps({"possible_secret_types": labels}))
            return 1 if labels else 0
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
