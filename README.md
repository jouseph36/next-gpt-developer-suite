# Next GPT Developer Suite v0.2

Open-source, security-first starter toolkit for building, testing and operating AI developer agents.

> **Status: v0.2 prototype.** This repository contains runnable Python standard-library tooling, example agent specifications, a plugin scaffold generator, an evaluation runner, GitHub CI, and bilingual documentation. It does **not** provide live Claude, Manus or OpenAI connections out of the box.

## Quick start

Requires Python 3.11+; no external dependencies for local tests.

```bash
python -m unittest discover -s tests -v
python -m nextgpt.cli doctor
python -m nextgpt.cli scaffold demo-agent --output ./generated
python -m nextgpt.cli eval examples/eval_cases.json
```

## Modules

- **Agent engineering:** declarative agent spec and basic validation
- **Plugin factory:** safe starter scaffold generator
- **Evaluation:** deterministic JSON test-case runner
- **Project memory:** local JSON notes with atomic writes
- **Security:** secret-pattern checks, path validation, least-privilege guidance
- **GitHub workflows:** CI tests and security lint
- **Integrations:** documented adapters for OpenAI, Claude, Manus Flex and VPS (not configured)

## Repository map

`nextgpt/` core CLI and modules · `tests/` unit tests · `examples/` example fixtures · `docs/` English/Arabic guides · `.github/workflows/` CI.

## Security

Do not commit tokens, credentials, P12 files or private keys. Local memory may contain sensitive notes; the `.nextgpt/` directory is ignored by Git. Review [SECURITY.md](SECURITY.md) before connecting external services.

## License

MIT — see [LICENSE](LICENSE). Contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Arabic overview: [README_AR.md](README_AR.md).
