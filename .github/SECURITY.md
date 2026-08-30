# Security Policy

HiTo is a security-focused project — vulnerability reports are especially welcome and taken seriously.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest release (>= v2.6) | ✅ |
| older releases | ❌ upgrade first |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security reports.**

Use GitHub's private vulnerability reporting:
**https://github.com/Vuln-SafeLab/HiTo/security/advisories/new**

Include:

1. Affected component (e.g. `src/middleware.ts`, Kun engine, auth/session, setup wizard, upload, SSRF surfaces in `src/lib/metadata-fetch.ts`)
2. Reproduction steps or a proof-of-concept
3. Impact assessment
4. Suggested fix (optional)

## Response Targets

- **Acknowledgement:** within 72 hours
- **Triage & severity assessment:** within 7 days
- **Fix & disclosure:** coordinated with the reporter; credit given unless anonymity is requested

## Scope

In scope: authentication/session handling, the Kun edge engine (bypass of scan/PoW/rate-limit/ban logic), the install wizard takeover window, upload handling, SSRF in outbound fetches, and injection/XSS in rendered content.

Out of scope: self-XSS, volumetric DoS without a logic bypass, issues requiring a compromised host, and reports from automated scanners without a working PoC.
