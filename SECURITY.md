# Security Policy

## What this repository is

This is a **demo/reference repository**: three build briefs (`docs/Spec-Ingest-Tool.md`,
`docs/Console.md`, `docs/Exec-Assistant.md`) plus minimal, non-production
scaffolds that implement a subset of each. There is no released version, no
deployed instance, and no supported version line — every branch is a
work-in-progress scaffold. "Supported versions" in the usual sense do not
apply here.

## Security posture

Each brief specifies a real security posture that applies to anything built
from it, and to this repo's own content — see the **Security** section of
[`README.md`](README.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full list. In summary:

- No credentials, tokens, connection strings, or private keys in this
  repository, in generated output, or in sample/test data.
- No model, model-provider SDK, or API key in anything shipped — a provider
  package landing in a lockfile is treated as a build failure.
- Every source document fed to the Spec-Ingest Tool is treated as untrusted
  input; extracted content is quoted material, never an instruction.
- Dependency vulnerabilities are tracked via `npm audit` in
  [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (blocks on push/PR)
  and [`.github/workflows/daily-health-check.yml`](.github/workflows/daily-health-check.yml)
  (daily status, opens/updates a tracking issue).

## Reporting a vulnerability

This is a personal demo repository, not a production system with an
incident-response process. If you find a security issue in the scaffold
code or briefs, open a GitHub issue on this repository describing the
problem. Please do not include real credentials, tokens, or sensitive data
in the issue — describe the class of problem and where it is, not a live
exploit against a real system.
