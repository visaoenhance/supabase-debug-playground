# Security Policy

Thank you for helping keep **supabase-debug-playground** secure.

This repository demonstrates validation patterns and debugging discipline for Supabase environments. While it is a demo/learning repo, we take security reports seriously.

---

## Supported Versions

This repository is maintained on the `main` branch only.

Security and dependency updates may be applied via:
- Dependabot
- CodeQL scanning
- GitHub Secret Scanning

---

## Reporting a Vulnerability

If you discover a security vulnerability:

**Please do NOT open a public issue.**

Instead, report it via one of the following:
- **GitHub Private Vulnerability Reporting** (preferred)
- **Email:** info@visaoenhance.com

When reporting, please include:
- Description of the vulnerability
- Steps to reproduce (proof-of-concept if available)
- Impact assessment
- Suggested remediation (if known)

**Response expectations**
- Acknowledgement within **48 hours**
- A status update within **7 days** (or sooner if critical)

---

## Scope

This repository:
- Does **not** store production credentials.
- Does **not** ship production infrastructure.
- Is intended for **local Supabase development** and validation experimentation.

If a vulnerability impacts the **Supabase platform itself**, please report it directly to Supabase via their responsible disclosure process.

---

## Security Philosophy

This project promotes a validation-first approach:

> **No Evidence. Not done.**

Coding assistants and agents should:
- Prove database writes (return rows/IDs)
- Validate RLS across roles (anon/auth/service)
- Confirm schema ↔ types alignment
- Never assume success without evidence

Security is not a feature. It is a discipline.

Thank you for contributing responsibly.
