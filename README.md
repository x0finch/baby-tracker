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
pnpm test:e2e      # build the web app, then Playwright end-to-end tests (e2e/)
```

### End-to-end tests

`e2e/` drives the built app in Chromium against a local API (`wrangler dev` with a throwaway D1 database and seeded sessions, see `e2e/scripts/serve.mjs`). It covers logging and undo, timers, two-device sync, invites and family deletion, the bottom sheet, and screenshots of the key screens. CI runs it in the Playwright container on every pull request. After an intended visual change, run the **E2E screenshots** workflow on the branch to regenerate the baselines in `e2e/tests/*-snapshots`.

Tooling: [oxlint](https://oxc.rs/docs/guide/usage/linter) (type-aware via `oxlint-tsgolint`), [oxfmt](https://oxc.rs/docs/guide/usage/formatter), TypeScript 7 and Vitest. In VS Code, install the recommended Oxc extension for format-on-save and lint fixes.

## API and deployment

`apps/api` is a [Hono](https://hono.dev) Worker on Cloudflare with a D1 database (schema in `src/db/schema.ts`, Drizzle migrations in `migrations/`). The SPA build is served by the same Worker through Workers Static Assets; only `/api/*` runs Worker code.

```sh
pnpm --filter @bobo/api db:migrate:local   # create/upgrade the local D1 database
pnpm dev                                    # web on :3000 (proxies /api) + wrangler dev on :8787
pnpm --filter @bobo/api db:generate         # after changing the schema
```

Local secrets: copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and fill it in.

First deploy: `wrangler d1 create bobo-db`, put the returned id into `apps/api/wrangler.jsonc`, run `pnpm --filter @bobo/api db:migrate:remote`, set the secrets with `wrangler secret put` (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), then `pnpm --filter @bobo/api deploy`.

Auth uses [Better Auth](https://better-auth.com) tuned for the Workers free plan (10ms CPU): minimal build, signed cookie cache so most requests validate the session without D1, no password hashing, no DB-backed rate limiting.

## Internationalization

UI strings live in `apps/web/messages/{locale}.json` and are compiled by [Paraglide JS](https://paraglidejs.com) into typed functions (`m.someKey()`) in `apps/web/src/paraglide` (generated on install and by the Vite plugin; not committed). Only `zh-CN` ships today.

- Never hard-code user-facing text in JSX; `react/jsx-no-literals` enforces this.
- Format numbers and dates with the helpers in `apps/web/src/lib/i18n.ts`, which use `Intl` with the active locale.
- To add a locale, add it to `apps/web/project.inlang/settings.json` and create `messages/<locale>.json`; the language picker in settings appears once there is more than one locale.

## Layout

| Path              | Package        | Description                             |
| ----------------- | -------------- | --------------------------------------- |
| `apps/web`        | `@bobo/web`    | TanStack Start client (static SPA)      |
| `apps/api`        | `@bobo/api`    | Hono API on Cloudflare Workers          |
| `packages/shared` | `@bobo/shared` | Schemas and types shared by web and api |
| `e2e`             | `@bobo/e2e`    | Playwright end-to-end tests             |

Internal packages export TypeScript source directly; consuming apps compile them with their own bundler.
