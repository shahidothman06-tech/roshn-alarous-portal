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

## How data works now

Data is served by a small **Node.js + Express backend** in `server/`, backed
by a plain JSON file on disk (`server/data/db.json`). Because the frontend
talks to that server instead of `localStorage`, the same data is shared across
every device/browser that points at the server — the Site Team's edits show up
in the Buyer view.

### Run the backend + frontend together

Open **two terminals**:

```bash
# Terminal 1 — API server (http://localhost:4000)
cd roshn-portal/server
npm install      # first time only — installs express + cors (no build tools)
npm start        # -> [server] ... listening on http://localhost:4000
```

```bash
# Terminal 2 — Vite frontend (http://localhost:5173)
cd roshn-portal
npm install      # first time only
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`). The site works
exactly as before, just backed by the server.

Notes:
- **Zero build tools / no native deps.** The store is plain JSON files, so
  `npm install` in `server/` works on any machine (no SQLite / node-gyp).
- On first run the server seeds `server/data/db.json` with the demo unit
  `ALR-114`. Delete that file to reset to defaults; it is git-ignored.
- The frontend calls `http://localhost:4000/api/...` (see `API_BASE` in
  `src/App.jsx`). If you host the API elsewhere, change `API_BASE` and add the
  new origin to `ALLOWED_ORIGINS` in `server/index.js`.

### API endpoints

```
GET   /api/health
GET   /api/units/:id                    -> unit record (404 if unknown)
PUT   /api/units/:id                    -> upsert unit record
GET   /api/units/:id/phases             -> ordered phases array
PUT   /api/units/:id/phases             -> replace phases array
PATCH /api/units/:id/phases/:key        -> { percent } update one phase
GET   /api/units/:id/updates            -> site updates (newest first)
PUT   /api/units/:id/updates            -> replace updates array
POST  /api/units/:id/updates            -> prepend one update
```

## Going further

The `server/` backend is a working stand-in that stores data in a JSON file —
great for demos and small deployments, but not a production database. See
`backend_data_model.md` for the full intended data model (Buyer, Project, Unit,
ConstructionPhase, etc.) and the complete REST contract.

## Next steps for a production app
1. Swap the JSON-file store (`server/store.js`) for a real database
   (Postgres is a solid default) — the Express routes in `server/index.js`
   stay largely the same.
2. Add authentication so each buyer only sees their own unit, and only
   site engineers/PMs can edit progress (the `/phases` PATCH and `/updates`
   POST endpoints).
3. Deploy the backend, point `API_BASE` in `src/App.jsx` at its URL (and add
   that origin to `ALLOWED_ORIGINS` in `server/index.js`), then deploy this
   frontend (`npm run build`) to a static host, or embed it inside ROSHN's
   existing customer app.
