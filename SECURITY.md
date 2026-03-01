# Security Policy

Thank you for helping keep supabase-debug-playground secure.

This repository demonstrates validation patterns and debugging discipline for Supabase environments. While it is a demo and learning repository, we take security concerns seriously.

---

## Supported Versions

This repository is maintained on the `main` branch.

Security updates and dependency updates are applied via:

- Dependabot
- CodeQL scanning
- GitHub Secret Scanning

---

## Reporting a Vulnerability

If you discover a security vulnerability:

Please do **NOT** open a public issue.

Instead, report it via one of the following:

- GitHub Private Vulnerability Reporting (preferred)
- Email: info@visaoenhance.com

When reporting, please include:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested remediation (if known)

You will receive acknowledgment within 48 hours.

---

## Scope

This repository:

- Does NOT store production credentials.
- Does NOT ship production infrastructure.
- Is intended for local Supabase development and validation experimentation.

If a vulnerability impacts the Supabase platform itself, please report it directly to Supabase via their responsible disclosure program.

---

## Security Philosophy

This project promotes a validation-first approach:

> No Evidence. Not done.

Coding assistants and agents should:

- Prove database writes
- Validate RLS across roles
- Confirm schema alignment
- Never assume success without evidence

Security is not a feature. It is a discipline.

Thank you for contributing responsibly.
