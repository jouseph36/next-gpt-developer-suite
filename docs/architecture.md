# Architecture v0.2

The core package uses only the Python standard library.

- `agents.py`: validated declarative agent specifications
- `factory.py`: creates isolated starter directories, refuses overwrite
- `evaluation.py`: deterministic exact-match JSON evaluation
- `memory.py`: atomic local JSON memory; no cloud sync
- `security.py`: basic secret-pattern screening and safe names
- `cli.py`: offline command-line interface

## Trust boundaries

Prompts, external model output and repository content must be considered untrusted input. The prototype has no autonomous write/deploy loop and no network adapters. A future integration layer should separate read-only tools from approved write actions.

## Roadmap

- v0.3: typed provider interfaces, mocked OpenAI/Claude adapters, integration tests
- v0.4: task queue, policy checks and signed audit records
- v0.5: optional VPS deployment templates and interactive dashboard

Roadmap entries are plans, not shipped capabilities.
