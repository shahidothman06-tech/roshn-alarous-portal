// ---------------------------------------------------------------------------
// Default demo data. Mirrors the frontend defaults in ../src/App.jsx so the
// seeded backend behaves exactly like the app expects on first run.
// ---------------------------------------------------------------------------

const DEFAULT_UNIT_ID = "ALR-114";

// Static per-phase config shared across units. `milestonePct` is the share of
// the total contract value tied to that phase (sums to 100). `dateRange` is a
// display-only planned window. The frontend keeps a parallel copy (with icons)
// in PHASE_META; keep the keys/names in sync.
const PHASE_META = [
  { key: "land", name: "Land Development & Infrastructure", milestonePct: 15, dateRange: "Mar 2024 – Sep 2024" },
  { key: "structure", name: "Foundation & Structure", milestonePct: 25, dateRange: "Sep 2024 – Mar 2025" },
  { key: "mep", name: "Masonry & MEP Rough-in", milestonePct: 30, dateRange: "Mar 2025 – Nov 2025" },
  { key: "finishing", name: "Finishing & Fit-out", milestonePct: 25, dateRange: "Nov 2025 – Jul 2026" },
  { key: "handover", name: "Handover & Inspection", milestonePct: 5, dateRange: "Jul 2026 – Q2 2027" },
];

const PHASE_KEYS = PHASE_META.map((p) => p.key);

function phaseName(key) {
  const p = PHASE_META.find((m) => m.key === key);
  return p ? p.name : key;
}

function defaultUnitRecord(unitId) {
  return {
    unitId,
    buyerName: "Ahmed Al-Otaibi",
    project: "Alarous",
    block: "Block 14, Cluster C",
    city: "Jeddah",
    villaType: "Type C — 4BR Detached Villa",
    plot: "450 m²",
    builtUp: "320 m²",
    floors: "Ground + 1",
    orientation: "North-facing plot",
    purchaseDate: "14 Feb 2024",
    estimatedHandover: "Q2 2027",
  };
}

function defaultPhases() {
  return [
    { key: "land", percent: 100, date: "Completed · Sep 2024" },
    { key: "structure", percent: 100, date: "Completed · Mar 2025" },
    { key: "mep", percent: 78, date: "In progress · Est. Nov 2025" },
    { key: "finishing", percent: 15, date: "Started · Est. Jul 2026" },
    { key: "handover", percent: 0, date: "Estimated Q2 2027" },
  ];
}

function defaultUpdates() {
  return [
    { date: "02 Jul 2026", title: "Roof slab casting completed", note: "Block 14 roof slab poured and cured. Scaffolding removal scheduled next week.", phaseKey: "mep" },
    { date: "21 Jun 2026", title: "Exterior wall plastering underway", note: "First coat of plaster applied to the north and east elevations.", phaseKey: "mep" },
    { date: "05 Jun 2026", title: "Electrical conduit installation", note: "First-fix electrical conduits laid across ground floor rooms.", phaseKey: "mep" },
    { date: "18 May 2026", title: "Blockwork reached second floor", note: "External blockwork for the upper level substantially complete.", phaseKey: "structure" },
  ];
}

// --- new per-unit collections ----------------------------------------------

// milestones: { phaseKey: boolean(paid) }
function emptyMilestones() {
  return PHASE_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {});
}

// notes: { phaseKey: [{ author, time, text }] }
function emptyNotes() {
  return PHASE_KEYS.reduce((acc, k) => ({ ...acc, [k]: [] }), {});
}

// The bundle persisted on disk for one unit.
function defaultUnitBundle(unitId) {
  return {
    unit: defaultUnitRecord(unitId),
    phases: defaultPhases(),
    updates: defaultUpdates(),
    milestones: emptyMilestones(),
    notes: emptyNotes(),
    messages: [], // [{ from, text, time }]
    activity: [], // [{ time, text }] newest first
  };
}

// Richer demo content for the seeded ALR-114 unit, so the portal looks alive.
function demoBundleALR114() {
  const bundle = defaultUnitBundle(DEFAULT_UNIT_ID);
  bundle.milestones = { land: true, structure: true, mep: false, finishing: false, handover: false };
  bundle.notes = {
    land: [{ author: "Site Engineer — Faisal", time: "Sep 2024", text: "Excavation and footings complete, passed municipal inspection." }],
    structure: [{ author: "Site Engineer — Faisal", time: "Mar 2025", text: "Roof slab poured on schedule." }],
    mep: [{ author: "Site Engineer — Faisal", time: "Jul 2026", text: "Block work on ground floor complete, MEP conduit routing underway." }],
    finishing: [],
    handover: [],
  };
  bundle.messages = [
    { from: "SITE TEAM", text: "Masonry is progressing well, on track for the Nov milestone.", time: "09 Jul 2026" },
    { from: "BUYER", text: "Great, thank you for the update! Any recent photos?", time: "10 Jul 2026" },
  ];
  bundle.activity = [
    { time: "09 Jul 2026", text: "Masonry & MEP Rough-in progress updated to 78%." },
    { time: "03 Jun 2026", text: "Foundation & Structure milestone (25%) marked as paid." },
    { time: "18 Sep 2024", text: "Land Development & Infrastructure milestone (15%) marked as paid." },
  ];
  return bundle;
}

// The canonical seed bundle for a given unit id: the rich demo data for
// ALR-114, empty-but-initialized defaults for any other unit. This is the
// single source of truth used both for the initial db.json seed and for the
// "Reset demo data" action, so a reset matches a fresh install exactly.
function seedBundle(unitId) {
  return unitId === DEFAULT_UNIT_ID ? demoBundleALR114() : defaultUnitBundle(unitId);
}

// Full seed used when no data file exists yet.
function seedDb() {
  return { [DEFAULT_UNIT_ID]: seedBundle(DEFAULT_UNIT_ID) };
}

module.exports = {
  DEFAULT_UNIT_ID,
  PHASE_META,
  PHASE_KEYS,
  phaseName,
  defaultUnitRecord,
  defaultPhases,
  defaultUpdates,
  emptyMilestones,
  emptyNotes,
  defaultUnitBundle,
  seedBundle,
  seedDb,
};
