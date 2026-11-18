# AI Policy

Guidelines for using AI coding tools in this repository.

## 1. Human Responsibility

- All code committed to this repository—regardless of whether it was written by a human or drafted by an AI—is the sole responsibility of the committer.
- Blindly committing AI output without understanding the underlying logic, database queries, and security implications is prohibited.

## 2. Verification Gates

Before any AI-assisted change is pushed or submitted for review, it must pass all local verification gates with zero errors and zero warnings:

- `pnpm type-check`: 0 errors (`tsc --noEmit`).
- `pnpm lint`: 0 errors, 0 warnings (`oxlint`).
- `pnpm test`: 100% pass rate (`vitest run`).
- Non-trivial logic (branches, security checks, database mutations) must be accompanied by automated tests.

## 3. Security & Boundaries

- **Fail-Closed by Default**: Authorization and database policies must always fail closed. Do not permit fallback access rules.
- **Input Validation**: All incoming requests and outgoing destinations must be validated and bounded. Never trust AI-generated regex or URL parsers without testing edge cases (e.g., SSRF, cloud metadata, port scanning).
- **No Unvetted Dependencies**: Do not install new third-party npm packages when the Node.js standard library or existing dependencies suffice.

## 4. Code Quality & Slop Prevention

- **Minimal Diffs**: Keep changes focused strictly on the requested task. Do not accept AI-generated boilerplate, speculative interfaces, or unused utility functions.
- **No Buzzwords or Fluff**: Documentation, commit messages, and PR descriptions must be direct, factual, and free of promotional jargon (e.g., *streamline*, *robust*, *cutting-edge*, *paradigm shift*).
- **Concise Comments**: Code comments must explain non-obvious constraints, not restate what the code clearly does.
