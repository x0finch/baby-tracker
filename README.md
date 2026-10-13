# Bobo

A local-first baby tracker for logging feeds, sleep, diapers and growth, with sharing across family members.

## Development

Requires Node.js 22+ and pnpm 12 (version pinned via `packageManager`).

```sh
pnpm install
pnpm dev        # run all apps in dev mode
pnpm build      # build all packages
pnpm typecheck
pnpm lint
pnpm test
```

## Layout

| Path              | Package        | Description                                |
| ----------------- | -------------- | ------------------------------------------ |
| `apps/web`        | `@bobo/web`    | TanStack Start client (static SPA)         |
| `apps/api`        | `@bobo/api`    | Hono API on Cloudflare Workers             |
| `packages/shared` | `@bobo/shared` | Schemas and types shared by web and api    |

Internal packages export TypeScript source directly; consuming apps compile them with their own bundler.
