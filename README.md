# NCC Admin

React admin dashboard for NCC e-commerce management.

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS 3 + shadcn/ui (Radix)
- TanStack React Query
- React Router 6
- Recharts
- Supabase (direct client)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in credentials
# Edit .env with your Supabase + Shopify credentials

# 3. Start dev server
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | .env | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | .env | Supabase anonymous key (public) |
| `VITE_SHOPIFY_STORE_URL` | .env | Shopify store URL |
| `SHOPIFY_ACCESS_TOKEN` | .env | Shopify Admin API token (server-side only) |

## Architecture

- **Frontend → Supabase**: Direct connection for all CRUD (cogs_mapping, style_mapping, fixed_costs)
- **Frontend → Vite proxy → Shopify**: Server proxy for Shopify Admin API (protects secret token)
- **No intermediate server layer** for database operations

## Pages

- `/` — Dashboard overview
- `/store/cogs` — COGS management (grouped table, inline edit, Shopify mapping)
- `/store/pnl` — Profit & Loss with charts
- `/store/orders` — Orders (coming soon)
- `/analytics` — Analytics (coming soon)
- `/org` — Org Chart (coming soon)
- `/settings` — Connection settings
