---
name: cicd-harden
description: Audits and hardens an existing CI/CD pipeline against supply-chain and injection attacks. Loads a platform reference (e.g. github-actions) with a full checklist. Use when securing pipelines.
argument-hint: <platform>
---

# Hardening a CI/CD pipeline

Audit an EXISTING pipeline and lock it down: pin every dependency to an immutable digest, minimize the pipeline token's scopes, and kill injection and untrusted-code-with-secrets risks. For a brand-new pipeline use `cicd-scaffold`; for a failing run use `cicd-debug`; for routine upkeep use `cicd-maintain`.

Apply `security-principles` (least privilege, pin the supply chain, distrust input) and `dev-principles`: keep the user's OWN pipeline dependency-minimal - prefer zero added third-party steps, only official or highly-trusted ones, every external dependency pinned to an immutable digest. The audit tools below are things you RUN, not steps you add.

## Stack guidance

Load `references/github-actions.md` for the target platform's concrete syntax and the full audit checklist (add more platforms as reference files); with no file for the user's platform, apply the guidance below and say so.

## Why this matters

Mutable tags and over-scoped tokens are the dominant CI/CD attack surface. In repeated 2025-2026 supply-chain incidents, attackers moved existing version tags to malicious commits that dumped runner memory and exfiltrated CI secrets across tens of thousands of pipelines; only those pinned to an immutable digest were unaffected. Least-privilege tokens and keeping untrusted code away from secrets contained the blast radius. The platform reference has the specific cases.

## Steps

1. **Inventory every external dependency** across all pipeline definitions and any reusable/composite units. List each one, its current ref (mutable tag vs immutable digest), and whether it is official/trusted or third-party.
2. **Pin everything to an immutable digest** (full commit SHA / image digest) plus a version comment. Pin internal reusable pipelines too. Enable any org/platform policy that can enforce pinning and block specific dependencies centrally.
3. **Drive the pipeline token to least privilege** - default-deny, then grant only the scopes each job actually uses. Flip any account/repo default that still grants write.
4. **Remove or rewrite injection sinks.** Find interpolations of attacker-controllable input inside shell/script steps and move them to environment variables referenced as quoted shell vars.
5. **Audit privileged triggers.** A trigger that runs with secrets and a write token in the base-repo context must never check out or execute untrusted contributor code. Prefer the unprivileged trigger unless privileged writes are truly required.
6. **Tighten secrets and cloud auth.** Replace long-lived cloud keys with short-lived federated credentials (OIDC), scoped to the deploy job. Map secrets explicitly to called pipelines instead of forwarding all of them.
7. **Run static analysis.** Use the platform's security and syntax linters; run them locally or as a pinned, official CI job.
8. **Automate dependency updates** so pins still get bumped for security fixes; `cicd-maintain` covers the cadence.
9. **Work the full checklist** in the platform reference and confirm each item.

## Gotchas

- Pinning a mutable tag is NOT enough; only an immutable digest is safe. Both tags and short SHAs can be moved.
- A pinned dependency still needs updating for security fixes - pinning plus an update bot, not pinning alone.
- Re-pin transitively: a pinned dependency can still call unpinned ones internally - prefer trusted publishers.
- Self-hosted runners on public repos are dangerous - a forked contribution can run arbitrary code on your infrastructure.
