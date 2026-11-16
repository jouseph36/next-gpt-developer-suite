# External integrations (planned)

All integrations are **disabled by default** in v0.2. No API credentials are bundled.

| Provider | Intended use | Status |
| --- | --- | --- |
| OpenAI API | Agent model calls, structured output and evaluation | Adapter not implemented |
| Claude | Cross-model reviews and comparisons | Adapter not implemented |
| Manus Flex | Task orchestration | Adapter not implemented |
| GitHub | Repository and CI automation | CI workflow provided; API adapter not implemented |
| VPS | Remote execution and deployment | Runbook only; no remote executor |

## Before implementing an adapter

1. Obtain credentials through the provider's official interface.
2. Load secrets from environment variables or a secret manager; never commit them.
3. Scope credentials to minimum required permissions.
4. Add timeouts, retries, usage budgets and audit logs.
5. Add mocked tests; request user approval before writes or deployments.
6. Keep production integrations opt-in.

This repository does not impersonate or provide unofficial access to any third-party model.
