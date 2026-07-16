// ---------------------------------------------------------------------------
// ROSHN Alarous buyer portal — REST backend.
//
// Lightweight Express server backed by a single JSON file (see store.js).
// Serves the same three resources the frontend used to keep in localStorage:
//   unit:{id}    -> GET  /api/units/:id            (get)  | PUT  (update)
//   phases:{id}  -> GET  /api/units/:id/phases      (get)  | PATCH /:key (per-phase)
//   updates:{id} -> GET  /api/units/:id/updates     (get)  | POST  (add one)
//
// Bulk PUT endpoints for /phases and /updates are also provided so the
// frontend's generic storageSet(key, value) adapter can keep its signature.
// ---------------------------------------------------------------------------

const express = require("express");
const cors = require("cors");
const store = require("./store");

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS so the Vite dev frontend (http://localhost:5173) can call this
// API from the browser. Also allow the 127.0.0.1 alias and non-browser tools
// (curl/no-origin). Widen this list if you serve the frontend elsewhere.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json());

// Ensure the unit bundle exists so PUT/POST can upsert a brand-new unit id
// (the "Load / create" flow in the Site Team view).
function ensureBundle(db, unitId) {
  if (!db[unitId]) db[unitId] = { unit: null, phases: null, updates: null };
  return db[unitId];
}

// --- health -----------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "roshn-alarous-portal-server" });
});

// --- unit record ------------------------------------------------------------
// GET returns the unit record, or null (404) if this unit id is unknown — the
// frontend treats null as "not created yet" and seeds defaults.
app.get("/api/units/:id", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle || !bundle.unit) return res.status(404).json(null);
  res.json(bundle.unit);
});

// PUT upserts the whole unit record.
app.put("/api/units/:id", (req, res) => {
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  bundle.unit = req.body;
  store.writeDb(db);
  res.json(bundle.unit);
});

// --- phases -----------------------------------------------------------------
app.get("/api/units/:id/phases", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle || !bundle.phases) return res.status(404).json(null);
  res.json(bundle.phases);
});

// PUT replaces the full ordered phases array (used by the storageSet adapter
// and by "Reset demo data").
app.put("/api/units/:id/phases", (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : req.body && req.body.phases;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: "expected an array of phases" });
  }
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  bundle.phases = incoming;
  store.writeDb(db);
  res.json(bundle.phases);
});

// PATCH updates the percent_complete of a single phase by its key, matching
// the internal contract in backend_data_model.md. Returns the full array.
app.patch("/api/units/:id/phases/:key", (req, res) => {
  const { percent } = req.body || {};
  if (typeof percent !== "number" || Number.isNaN(percent)) {
    return res.status(400).json({ error: "body must include numeric 'percent'" });
  }
  const db = store.readDb();
  const bundle = store.getBundle(db, req.params.id);
  if (!bundle || !bundle.phases) return res.status(404).json({ error: "unit or phases not found" });
  const phase = bundle.phases.find((p) => p.key === req.params.key);
  if (!phase) return res.status(404).json({ error: `phase '${req.params.key}' not found` });
  phase.percent = Math.max(0, Math.min(100, Math.round(percent)));
  store.writeDb(db);
  res.json(bundle.phases);
});

// --- site updates -----------------------------------------------------------
app.get("/api/units/:id/updates", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle || !bundle.updates) return res.status(404).json(null);
  res.json(bundle.updates);
});

// PUT replaces the full updates array (used by the storageSet adapter and by
// "Reset demo data").
app.put("/api/units/:id/updates", (req, res) => {
  const incoming = Array.isArray(req.body) ? req.body : req.body && req.body.updates;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: "expected an array of updates" });
  }
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  bundle.updates = incoming;
  store.writeDb(db);
  res.json(bundle.updates);
});

// POST prepends a single new update (newest first), matching the internal
// contract in backend_data_model.md. Returns the full array.
app.post("/api/units/:id/updates", (req, res) => {
  const entry = req.body;
  if (!entry || typeof entry.title !== "string" || !entry.title.trim()) {
    return res.status(400).json({ error: "update requires a non-empty 'title'" });
  }
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  if (!bundle.updates) bundle.updates = [];
  bundle.updates = [entry, ...bundle.updates];
  store.writeDb(db);
  res.status(201).json(bundle.updates);
});

// --- start ------------------------------------------------------------------
store.ensureSeed(); // create + seed data/db.json on first run
app.listen(PORT, () => {
  console.log(`[server] ROSHN Alarous portal API listening on http://localhost:${PORT}`);
  console.log(`[server] CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
