# ROSHN Alarous — Buyer Portal (standalone)

A React + Vite version of the villa construction progress tracker, runnable
on your own machine.

## Requirements
- Node.js 18+ and npm (check with `node -v` and `npm -v`)

## Run it locally

```bash
cd roshn-portal
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
```

This outputs static files to `dist/` — you can host those on any static
host (Vercel, Netlify, S3 + CloudFront, nginx, etc.).

## How data works right now

This standalone build stores data in the browser's `localStorage`, so:
- It persists across page reloads on the same device/browser.
- It is **not shared** between different people's browsers — the "Site
  Team" view and "Buyer" view only share data if opened in the same
  browser.

That's fine for trying things out locally, but for a real product you need
a real backend so the site team's updates show up on the buyer's phone.

## Going live with real data

See `backend_data_model.md` (in the parent folder) for:
- The full data model (Buyer, Project, Unit, ConstructionPhase, etc.)
- The REST API endpoints a backend should expose
- Exactly which two functions in `src/App.jsx` to change

In short: open `src/App.jsx`, find `storageGet` and `storageSet` near the
top, and replace their bodies with `fetch()` calls to your real API instead
of `localStorage`. Nothing else in the file needs to change.

## Next steps for a production app
1. Build the backend (Node/Express, or any stack) implementing the API
   contract in `backend_data_model.md`, backed by a real database
   (Postgres is a solid default).
2. Add authentication so each buyer only sees their own unit, and only
   site engineers/PMs can edit progress.
3. Point `storageGet`/`storageSet` in `src/App.jsx` at that API.
4. Deploy the backend, then deploy this frontend (`npm run build`) to a
   static host, or embed it inside ROSHN's existing customer app.
