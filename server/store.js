// ---------------------------------------------------------------------------
// Tiny JSON-file data store. No database, no native modules — just a single
// JSON file on disk that is read on demand and written atomically.
//
// On-disk shape (data/db.json):
//   {
//     "ALR-114": { "unit": {...}, "phases": [...], "updates": [...] },
//     ...
//   }
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { seedDb } = require("./defaults");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Create the data file with default demo data the first time the server runs.
function ensureSeed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    writeDb(seedDb());
    console.log(`[store] seeded new data store at ${DB_FILE}`);
  }
}

function readDb() {
  ensureSeed();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    // If the file is somehow corrupt, don't crash — reseed and keep serving.
    console.error(`[store] could not parse ${DB_FILE}, reseeding:`, e.message);
    const fresh = seedDb();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomic write: write to a temp file, then rename over the real one so a
  // reader never sees a half-written file.
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// Convenience: get (and lazily create) the bundle object for a unit id.
function getBundle(db, unitId) {
  return db[unitId] || null;
}

module.exports = { DATA_DIR, DB_FILE, ensureSeed, readDb, writeDb, getBundle };
