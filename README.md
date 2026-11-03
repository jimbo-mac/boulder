# Boulder

> *One must imagine Sisyphus happy.*

A personal web app for logging runs and lifts and watching progress over time. See [SPEC.md](SPEC.md).

## Setup

Requires Node 20+.

```sh
npm install
cp .env.example .env.local   # fill in keys (from slice 2 onward)
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Run tests once |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build to `dist/` |

## Deploy

Vercel auto-deploys `main` (framework preset: Vite, output `dist`).
