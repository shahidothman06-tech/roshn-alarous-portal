// ---------------------------------------------------------------------------
// Default demo data. Mirrors defaultUnitRecord / defaultPhases /
// defaultUpdates in ../src/App.jsx so the seeded backend behaves exactly like
// the old localStorage build did on first run.
// ---------------------------------------------------------------------------

const DEFAULT_UNIT_ID = "ALR-114";

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
    { date: "02 Jul 2026", title: "Roof slab casting completed", note: "Block 14 roof slab poured and cured. Scaffolding removal scheduled next week." },
    { date: "21 Jun 2026", title: "Exterior wall plastering underway", note: "First coat of plaster applied to the north and east elevations." },
    { date: "05 Jun 2026", title: "Electrical conduit installation", note: "First-fix electrical conduits laid across ground floor rooms." },
    { date: "18 May 2026", title: "Blockwork reached second floor", note: "External blockwork for the upper level substantially complete." },
  ];
}

// The shape persisted on disk: one entry per unit id.
function defaultUnitBundle(unitId) {
  return {
    unit: defaultUnitRecord(unitId),
    phases: defaultPhases(),
    updates: defaultUpdates(),
  };
}

// Full seed used when no data file exists yet.
function seedDb() {
  return { [DEFAULT_UNIT_ID]: defaultUnitBundle(DEFAULT_UNIT_ID) };
}

module.exports = {
  DEFAULT_UNIT_ID,
  defaultUnitRecord,
  defaultPhases,
  defaultUpdates,
  defaultUnitBundle,
  seedDb,
};
