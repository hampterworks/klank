---
id: security-principles
title: Security principles (least privilege, distrust input)
scope: global
agents: [all]
priority: 23
---

When building or reviewing anything that touches access, input, dependencies, or secrets, default to:

- **Least privilege, default-deny.** Grant the minimum scope, permission, and access on the narrowest
  surface for the shortest time; deny by default and add only what is needed.
- **Distrust the outside.** Validate and encode every input at trust boundaries; never interpolate
  untrusted data into a shell, query, or template; treat third-party code and data as hostile until proven safe.
- **Secure the supply chain.** Pin dependencies to immutable digests, prefer official and maintained
  sources, and keep secrets out of code, logs, and artifacts.
- **Assume breach, shrink the blast radius.** Scope secrets and credentials (short-lived where possible),
  fail safe, and design so one compromise cannot cascade.
