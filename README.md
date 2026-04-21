# maps-lab

Monorepo for:

- Last Chances Map
- Atmosphere Map
- Border Friction Map

This repository starts as a shared development base and is designed so each app can later be split into its own repository.

## Current status

The repository currently contains:

- monorepo root configuration
- shared `@maps-lab/core-schema`
- `data/seeds/last-chances/seed-input.json`
- a first-pass `scripts/seed/build-last-chances-records.ts`
- a minimum `apps/last-chances-map` Next.js app

The other two apps are not started yet.

## Repository structure

```txt
apps/
  last-chances-map/
packages/
  core-schema/
data/
  seeds/
    last-chances/
scripts/
  seed/
```

## Run Last Chances Map locally

From the repo root:

```bash
pnpm install
pnpm dev:last-chances
```

Then open the local URL shown by Next.js.

## Current Last Chances routes

- `/` homepage
- `/map` lightweight discovery map
- `/list` archive list
- `/record/[slug]` detail page
- `/stats` first-pass stats page

## Seed data

The app currently reads from:

```txt
data/seeds/last-chances/seed-input.json
```

A record build script is also included:

```bash
pnpm seed:build:last-chances
```

That script generates:

```txt
data/seeds/last-chances/records.generated.json
```

At the moment, the app runtime still reads `seed-input.json` directly so iteration stays simple.

## Design direction

- Last Chances Map: serif, paper-like archive
- Atmosphere Map: off-white, photo-first guide
- Border Friction Map: sans-serif, operational clarity

## Notes

- Stats/history deeper implementation is intentionally deferred for now.
- Atmosphere history is planned as none.
- Last Chances history is planned as event-based.
- Border Friction history is planned as snapshot-based.
