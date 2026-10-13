# Bobo

A local-first baby tracker for logging feeds, sleep, diapers and growth, with sharing across family members.

## Development

Requires Node.js 22+ and pnpm 12 (version pinned via `packageManager`).

```sh
pnpm install
pnpm dev           # run all apps in dev mode
pnpm build         # build all packages
pnpm check         # format:check + lint + typecheck + test (run before pushing)
pnpm format        # format with oxfmt
pnpm lint          # oxlint with type-aware rules
pnpm typecheck     # tsc (TypeScript 7)
pnpm test          # vitest
```

Tooling: [oxlint](https://oxc.rs/docs/guide/usage/linter) (type-aware via `oxlint-tsgolint`), [oxfmt](https://oxc.rs/docs/guide/usage/formatter), TypeScript 7 and Vitest. In VS Code, install the recommended Oxc extension for format-on-save and lint fixes.

## Layout

| Path              | Package        | Description                             |
| ----------------- | -------------- | --------------------------------------- |
| `apps/web`        | `@bobo/web`    | TanStack Start client (static SPA)      |
| `apps/api`        | `@bobo/api`    | Hono API on Cloudflare Workers          |
| `packages/shared` | `@bobo/shared` | Schemas and types shared by web and api |

Internal packages export TypeScript source directly; consuming apps compile them with their own bundler.
