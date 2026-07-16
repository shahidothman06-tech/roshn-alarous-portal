// ---------------------------------------------------------------------------
// ROSHN Alarous buyer portal — REST backend.
//
// Lightweight Express server backed by a single JSON file (see store.js). Each
// unit's bundle holds these collections, following one consistent pattern:
//   unit        GET /api/units/:id                | PUT
//   phases      GET /api/units/:id/phases         | PUT | PATCH /:key (per-phase %)
//   updates     GET /api/units/:id/updates        | PUT | POST (add one)
//   milestones  GET /api/units/:id/milestones     | PUT /:key  { paid }
//   notes       GET /api/units/:id/notes          | POST /:key { text }
//   messages    GET /api/units/:id/messages       | POST { from, text }
//   activity    GET /api/units/:id/activity       (auto-generated, read-only)
//
// The activity log is appended server-side whenever a phase percent changes, a
// milestone is toggled, or a note is added (see appendActivity).
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const store = require("./store");
const { phaseName, emptyMilestones, emptyNotes, seedBundle } = require("./defaults");

const app = express();
const PORT = process.env.PORT || 4000;

// --- photo uploads ----------------------------------------------------------
// Uploaded photos are stored as plain files in server/uploads/ and served
// statically at /uploads, so the frontend can load them by URL.
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error("only image files are allowed"));
  },
});

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

// Serve uploaded photos.
app.use("/uploads", express.static(UPLOAD_DIR));

// Ensure the unit bundle exists (and all its collections are initialized) so
// PUT/POST can upsert a brand-new unit id (the "Load / create" flow in the
// Site Team view).
function ensureBundle(db, unitId) {
  if (!db[unitId]) db[unitId] = { unit: null, phases: null, updates: null };
  const b = db[unitId];
  if (!b.milestones) b.milestones = emptyMilestones();
  if (!b.notes) b.notes = emptyNotes();
  if (!Array.isArray(b.messages)) b.messages = [];
  if (!Array.isArray(b.activity)) b.activity = [];
  return b;
}

// Human-readable timestamp for activity-log / message entries, e.g.
// "17 Jul 2026 · 14:30".
function nowStamp() {
  const d = new Date();
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// Append an auto-generated entry to a unit's activity log (newest first).
// Used whenever a phase percent changes, a milestone is toggled, or a note is
// added. The caller is responsible for writing the db.
function appendActivity(bundle, text) {
  if (!Array.isArray(bundle.activity)) bundle.activity = [];
  bundle.activity = [{ time: nowStamp(), text }, ...bundle.activity];
}

// --- health -----------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "roshn-alarous-portal-server" });
});

// --- photo upload -----------------------------------------------------------
// Accepts a multipart form with a single "photo" file, stores it in
// server/uploads/, and returns an absolute URL the frontend can attach to an
// update as `photoUrl`.
app.post("/api/uploads", upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file uploaded (field 'photo')" });
  const relPath = `/uploads/${req.file.filename}`;
  const url = `${req.protocol}://${req.get("host")}${relPath}`;
  res.status(201).json({ url, path: relPath, filename: req.file.filename });
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

// POST resets a unit to its seed state — the same data a fresh db.json would
// contain (rich demo for ALR-114, empty-but-initialized defaults otherwise).
// Wipes phases, updates, milestones, notes, messages and activity. Returns the
// full fresh bundle so the frontend can update every panel without a refresh.
app.post("/api/units/:id/reset", (req, res) => {
  const db = store.readDb();
  const fresh = seedBundle(req.params.id);
  db[req.params.id] = fresh;
  store.writeDb(db);
  res.json(fresh);
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
  const next = Math.max(0, Math.min(100, Math.round(percent)));
  if (next !== phase.percent) {
    phase.percent = next;
    appendActivity(bundle, `${phaseName(phase.key)} progress updated to ${next}%.`);
  }
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
// contract in backend_data_model.md. The entry may optionally include a
// `photoUrl` (from POST /api/uploads); it is stored as-is. Returns the array.
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

// --- payment milestones -----------------------------------------------------
// Simple model: each phase has a paid/unpaid boolean. State is per unit.
app.get("/api/units/:id/milestones", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle) return res.status(404).json(null);
  res.json(bundle.milestones || emptyMilestones());
});

// PUT toggles/sets one phase's milestone paid state and logs the change.
app.put("/api/units/:id/milestones/:key", (req, res) => {
  const { paid } = req.body || {};
  if (typeof paid !== "boolean") {
    return res.status(400).json({ error: "body must include boolean 'paid'" });
  }
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  bundle.milestones[req.params.key] = paid;
  appendActivity(bundle, `${phaseName(req.params.key)} milestone marked as ${paid ? "paid" : "unpaid"}.`);
  store.writeDb(db);
  res.json(bundle.milestones);
});

// --- site notes (per phase) -------------------------------------------------
// GET returns all notes grouped by phase key: { phaseKey: [{author,time,text}] }.
app.get("/api/units/:id/notes", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle) return res.status(404).json(null);
  res.json(bundle.notes || emptyNotes());
});

// POST appends a note to one phase and logs the change. Returns that phase's
// notes array.
app.post("/api/units/:id/notes/:key", (req, res) => {
  const { text, author } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "note requires non-empty 'text'" });
  }
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  if (!bundle.notes[req.params.key]) bundle.notes[req.params.key] = [];
  const note = { author: (author && String(author)) || "Site Team", time: nowStamp(), text: text.trim() };
  bundle.notes[req.params.key].push(note);
  appendActivity(bundle, `Note added on ${phaseName(req.params.key)}.`);
  store.writeDb(db);
  res.status(201).json(bundle.notes[req.params.key]);
});

// --- messages (buyer <-> site team) -----------------------------------------
app.get("/api/units/:id/messages", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle) return res.status(404).json(null);
  res.json(bundle.messages || []);
});

// POST appends a chat message. `from` is "BUYER" or "SITE TEAM".
app.post("/api/units/:id/messages", (req, res) => {
  const { from, text } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "message requires non-empty 'text'" });
  }
  const sender = from === "SITE TEAM" ? "SITE TEAM" : "BUYER";
  const db = store.readDb();
  const bundle = ensureBundle(db, req.params.id);
  bundle.messages.push({ from: sender, text: text.trim(), time: nowStamp() });
  store.writeDb(db);
  res.status(201).json(bundle.messages);
});

// --- activity log (read-only feed) ------------------------------------------
// Auto-generated entries appended by the percent/milestone/note endpoints.
app.get("/api/units/:id/activity", (req, res) => {
  const bundle = store.getBundle(store.readDb(), req.params.id);
  if (!bundle) return res.status(404).json(null);
  res.json(bundle.activity || []);
});

// --- error handling ---------------------------------------------------------
// Turns multer / upload errors (file too large, wrong type) into clean 400s
// instead of crashing the request.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `upload error: ${err.message}` });
  }
  if (err) return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: "internal server error" });
});

// --- start ------------------------------------------------------------------
store.ensureSeed(); // create + seed data/db.json on first run
app.listen(PORT, () => {
  console.log(`[server] ROSHN Alarous portal API listening on http://localhost:${PORT}`);
  console.log(`[server] CORS allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
