# Shajaratna — شجرتنا 🌳

Collaborative family trees with photos, in English & Arabic (RTL).

Relatives join a family group, build the tree together (parents on top,
children below), attach photos to every face, and discuss missing names,
dates and photos per person. Two families linked by marriage bridge into
one connected tree.

## Features

- 🔐 **Sign in** with Google or Facebook (OAuth), plus a quick **demo mode**
- 👪 **Family groups** — create a family, invite relatives with a code/link
- 🌳 **Interactive tree** — zoom, pan, collapse/expand branches, spouses shown side by side
- 📸 **Photos** for every person (auto-resized in the browser)
- 💬 **Discussion board** on each person ("does anyone have grandpa's photo?")
- 🤝 **Family bridging** — members of two families can link them by marriage
- 🌐 **English / العربية** toggle with full RTL support
- 👮 Roles: Owner / Admin / Member

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 · Auth.js v5 · SQLite (dev) → PostgreSQL (prod)

## Getting started

```bash
npm install
cp .env.example .env        # fill values if you have them
npm run db:push             # create local database
npm run db:seed             # optional: sample family (login: demo@shajaratna.app)
npm run dev
```

Open http://localhost:3000 — use **demo sign-in** with any name/email.

> Demo data family invite code: `DEMO1234`

## Setting up OAuth

### Google
1. https://console.cloud.google.com/apis/credentials → Create OAuth Client ID (Web)
2. Authorized redirect URI: `https://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for dev)
3. Put the ID & secret into `.env`

### Facebook
1. https://developers.facebook.com/apps → Create app (Facebook Login product)
2. Valid OAuth Redirect URI: `https://YOUR_DOMAIN/api/auth/callback/facebook`
3. Put the App ID & secret into `.env`

If a provider's keys are missing, its button simply doesn't appear.

## Deploying to Vercel

1. Push this repo to GitHub
2. Import it in Vercel
3. Add environment variables:
   - `DATABASE_URL` — your hosted Postgres connection string (Supabase/Neon/etc). The app auto-detects Postgres.
   - `AUTH_SECRET` (`npx auth secret`)
   - OAuth keys + callback URLs updated to your domain
   - `DEMO_MODE=false`
4. Run `npx prisma db push` once against the production DB (locally with the prod `DATABASE_URL`) to create tables

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:seed` | Insert demo family/user |

## Roadmap ideas

- GEDCOM import/export · timeline view · notifications · PWA offline · media gallery per person
