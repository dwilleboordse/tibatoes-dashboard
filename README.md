# TibaToes — Internal Dashboard

React + Vite + Supabase. Internal tool for keeping team accountable on OKRs, content calendar, creative testing, revenue forecast, and creator tracking.

## Setup

```bash
npm install
cp .env.example .env       # fill in Supabase URL + anon key
npm run dev                # http://localhost:5173
```

In Supabase: open the SQL editor and run the entire `schema.sql` file once.

## Stack

- React 19 + React Router 7
- Vite 6
- Supabase (auth + Postgres + RLS)
- Recharts (forecast charts)
- Lucide-react (icons)

## Features

1. **OKRs** — quarterly objectives with measurable key results
2. **Calendar** — launches, promos, content, milestones
3. **Creative Roadmap** — 12-column ad-test tracker (status, batch, concept, avatar, mass desire, awareness, type, format, test result, spend, hit rate, learnings)
4. **Revenue Forecast** — monthly target vs. actual revenue / spend / MER / gross profit
5. **Creators** — top creator analysis with platform links and trend notes
