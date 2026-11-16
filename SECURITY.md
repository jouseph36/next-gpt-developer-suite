# Security Policy

## Supported versions

Security reports are accepted for the latest version on the main branch.

## Reporting

Please do not disclose exploitable issues publicly before a fix. Contact the repository owner through GitHub's private vulnerability reporting feature when enabled, or request a private reporting channel without including exploit details in a public issue.

## Defaults

- Never commit API keys, access tokens, signing certificates or passwords.
- Keep external integrations opt-in and use least-privilege credentials.
- Treat agent outputs, repository text and tool results as untrusted.
- Require explicit approval before deployment, publication, deletion or production changes.
- Store local project memory outside Git; do not add personal data to examples.
- No network calls are made by the local starter CLI.
