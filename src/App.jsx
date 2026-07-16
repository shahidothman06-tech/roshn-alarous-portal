import React, { useEffect, useState, useCallback } from "react";
import {
  MapPin,
  Ruler,
  Calendar,
  Camera,
  Home,
  CheckCircle2,
  Clock3,
  CircleDashed,
  Phone,
  Mail,
  Building2,
  HardHat,
  Paintbrush,
  ClipboardCheck,
  Compass,
  Users,
  Eye,
  Plus,
  RotateCcw,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
const C = {
  bg: "#F5F1E6",
  ink: "#122019",
  inkSoft: "#4B564C",
  hairline: "#D8D0BC",
  green: "#0F3D2E",
  greenSoft: "#E7EFE9",
  coral: "#E15B3F",
  coralSoft: "#FCE7E1",
  gold: "#C9A24B",
  blueprint: "#7FA8A3",
  card: "#FFFFFF",
};

const FONT_DISPLAY = "'Space Grotesk', sans-serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

// ---------------------------------------------------------------------------
// Data model (mirrors what a real ROSHN backend would serve)
// unit:{unitId}    -> villa + buyer + project record
// phases:{unitId}  -> ordered construction phases with % complete
// updates:{unitId} -> site update log, newest first
// ---------------------------------------------------------------------------
const DEFAULT_UNIT_ID = "ALR-114";

const PHASE_META = [
  { key: "land", label: "Land Development & Infrastructure", icon: "Compass", weight: 15 },
  { key: "structure", label: "Foundation & Structure", icon: "Building2", weight: 25 },
  { key: "mep", label: "Masonry & MEP Rough-in", icon: "HardHat", weight: 30 },
  { key: "finishing", label: "Finishing & Fit-out", icon: "Paintbrush", weight: 25 },
  { key: "handover", label: "Handover & Inspection", icon: "ClipboardCheck", weight: 5 },
];

const ICONS = { Compass, Building2, HardHat, Paintbrush, ClipboardCheck };

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

function statusOf(percent) {
  if (percent >= 100) return "done";
  if (percent > 0) return "active";
  return "upcoming";
}

function overallPercent(phases) {
  const total = phases.reduce((sum, p) => {
    const meta = PHASE_META.find((m) => m.key === p.key);
    return sum + (p.percent * meta.weight) / 100;
  }, 0);
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// Storage helpers — now backed by the real REST API (server/), so data syncs
// across devices instead of living in one browser's localStorage.
//
// The key/value signatures are unchanged, so nothing else in this file had to
// change. Keys map onto REST resources:
//   "unit:{id}"    <-> GET/PUT  /api/units/{id}
//   "phases:{id}"  <-> GET/PUT  /api/units/{id}/phases
//   "updates:{id}" <-> GET/PUT  /api/units/{id}/updates
// (The server also exposes PATCH /phases/{key} and POST /updates per the
// contract in backend_data_model.md; this generic adapter uses the bulk
// PUT endpoints to preserve the storageGet/storageSet shape.)
// ---------------------------------------------------------------------------
const API_BASE = "http://localhost:4000/api";

function endpointFor(key) {
  const sep = key.indexOf(":");
  const type = key.slice(0, sep); // "unit" | "phases" | "updates"
  const id = key.slice(sep + 1);
  const base = `${API_BASE}/units/${encodeURIComponent(id)}`;
  return type === "unit" ? base : `${base}/${type}`;
}

async function storageGet(key) {
  try {
    const res = await fetch(endpointFor(key));
    if (res.status === 404) return null; // unknown unit -> caller seeds defaults
    if (!res.ok) throw new Error(`GET ${key} failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("API load failed", e);
    return null;
  }
}

async function storageSet(key, value) {
  try {
    const res = await fetch(endpointFor(key), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!res.ok) throw new Error(`PUT ${key} failed: ${res.status}`);
    return true;
  } catch (e) {
    console.error("API save failed", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signature element: villa elevation that "builds" with progress
// ---------------------------------------------------------------------------
function VillaProgressElevation({ percent }) {
  const top = 70;
  const bottom = 250;
  const fillY = bottom - ((bottom - top) * percent) / 100;

  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "auto" }}>
      <defs>
        <clipPath id="fillClip">
          <rect x="0" y={fillY} width="400" height={bottom - fillY + 4} />
        </clipPath>
      </defs>

      <line x1="20" y1={bottom} x2="380" y2={bottom} stroke={C.hairline} strokeWidth="2" />
      <circle cx="350" cy="45" r="14" fill="none" stroke={C.gold} strokeWidth="1.5" />

      <g stroke={C.blueprint} strokeWidth="1.3" fill="none" opacity="0.8">
        <line x1="60" y1={bottom} x2="66" y2="150" />
        <path d="M66 150 C 40 140, 30 120, 34 108" />
        <path d="M66 150 C 92 140, 102 120, 98 108" />
        <path d="M66 150 C 50 132, 46 118, 50 104" />
        <path d="M66 150 C 82 132, 86 118, 82 104" />
      </g>

      <g fill="none" stroke={C.blueprint} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9">
        <rect x="120" y={top} width="200" height={bottom - top} />
        <line x1="112" y1={top} x2="328" y2={top} />
        <rect x="150" y="170" width="70" height="80" />
        <rect x="240" y="110" width="26" height="34" />
        <rect x="276" y="110" width="26" height="34" />
        <rect x="240" y="180" width="26" height="34" />
        <rect x="285" y="205" width="24" height="45" />
      </g>

      <g clipPath="url(#fillClip)">
        <rect x="120" y={top} width="200" height={bottom - top} fill={C.greenSoft} stroke={C.green} strokeWidth="1.5" />
        <rect x="150" y="170" width="70" height="80" fill="#EDE6D2" stroke={C.green} strokeWidth="1.5" />
        <rect x="240" y="110" width="26" height="34" fill={C.card} stroke={C.green} strokeWidth="1.5" />
        <rect x="276" y="110" width="26" height="34" fill={C.card} stroke={C.green} strokeWidth="1.5" />
        <rect x="240" y="180" width="26" height="34" fill={C.card} stroke={C.green} strokeWidth="1.5" />
        <rect x="285" y="205" width="24" height="45" fill={C.coral} stroke={C.green} strokeWidth="1.5" />
        <line x1="112" y1={top} x2="328" y2={top} stroke={C.green} strokeWidth="2.5" />
      </g>

      <line x1="330" y1={fillY} x2="345" y2={fillY} stroke={C.coral} strokeWidth="1.5" />
      <line x1="345" y1={fillY} x2="345" y2={fillY - 14} stroke={C.coral} strokeWidth="1.5" />
      <text x="349" y={fillY - 16} fontFamily={FONT_MONO} fontSize="13" fill={C.coral} fontWeight="700">
        {percent}%
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const map = {
    done: { label: "Completed", bg: C.greenSoft, fg: C.green, Icon: CheckCircle2 },
    active: { label: "In progress", bg: C.coralSoft, fg: C.coral, Icon: Clock3 },
    upcoming: { label: "Upcoming", bg: "#EFEBE0", fg: C.inkSoft, Icon: CircleDashed },
  };
  const { label, bg, fg, Icon } = map[status];
  return (
    <span
      style={{ background: bg, color: fg, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.03em" }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded"
    >
      <Icon size={12} strokeWidth={2.5} />
      {label.toUpperCase()}
    </span>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid ${C.hairline}` }}>
      <Icon size={16} style={{ color: C.green, marginTop: 2 }} />
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>{label}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.ink, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  fontFamily: FONT_BODY,
  fontSize: 13,
  padding: "6px 8px",
  border: `1px solid ${C.hairline}`,
  borderRadius: 4,
  background: "#fff",
  color: C.ink,
  width: "100%",
};

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
export default function App() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const [view, setView] = useState("buyer"); // 'buyer' | 'team'
  const [unitId, setUnitId] = useState(DEFAULT_UNIT_ID);
  const [unitIdInput, setUnitIdInput] = useState(DEFAULT_UNIT_ID);
  const [unitData, setUnitData] = useState(null);
  const [phases, setPhases] = useState(null);
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newUpdate, setNewUpdate] = useState({ title: "", note: "" });

  const load = useCallback(async (id) => {
    setLoading(true);
    let u = await storageGet(`unit:${id}`);
    let p = await storageGet(`phases:${id}`);
    let up = await storageGet(`updates:${id}`);

    if (!u) {
      u = defaultUnitRecord(id);
      await storageSet(`unit:${id}`, u);
    }
    if (!p) {
      p = defaultPhases();
      await storageSet(`phases:${id}`, p);
    }
    if (!up) {
      up = defaultUpdates();
      await storageSet(`updates:${id}`, up);
    }

    setUnitData(u);
    setPhases(p);
    setUpdates(up);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(unitId);
  }, [unitId, load]);

  const saveUnitData = async (next) => {
    setUnitData(next);
    setSaving(true);
    await storageSet(`unit:${unitId}`, next);
    setSaving(false);
  };

  const savePhasePercent = async (key, percent) => {
    const next = phases.map((p) => (p.key === key ? { ...p, percent } : p));
    setPhases(next);
    setSaving(true);
    await storageSet(`phases:${unitId}`, next);
    setSaving(false);
  };

  const addUpdate = async () => {
    if (!newUpdate.title.trim()) return;
    const entry = {
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      title: newUpdate.title.trim(),
      note: newUpdate.note.trim(),
    };
    const next = [entry, ...updates];
    setUpdates(next);
    setNewUpdate({ title: "", note: "" });
    setSaving(true);
    await storageSet(`updates:${unitId}`, next);
    setSaving(false);
  };

  const resetDemo = async () => {
    const u = defaultUnitRecord(unitId);
    const p = defaultPhases();
    const up = defaultUpdates();
    setUnitData(u);
    setPhases(p);
    setUpdates(up);
    setSaving(true);
    await storageSet(`unit:${unitId}`, u);
    await storageSet(`phases:${unitId}`, p);
    await storageSet(`updates:${unitId}`, up);
    setSaving(false);
  };

  if (loading || !unitData || !phases || !updates) {
    return (
      <div
        style={{ background: C.bg, color: C.inkSoft, fontFamily: FONT_BODY, minHeight: 300 }}
        className="flex items-center justify-center gap-2 py-20"
      >
        <Loader2 size={16} className="animate-spin" />
        Loading unit {unitId}…
      </div>
    );
  }

  const OVERALL = overallPercent(phases);
  const displayPhases = phases.map((p) => {
    const meta = PHASE_META.find((m) => m.key === p.key);
    return { ...p, ...meta, status: statusOf(p.percent) };
  });
  const currentPhase = displayPhases.find((p) => p.status === "active") || displayPhases[0];

  return (
    <div
      style={{
        background: C.bg,
        color: C.ink,
        fontFamily: FONT_BODY,
        minHeight: "100%",
        backgroundImage:
          "linear-gradient(rgba(18,32,25,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(18,32,25,0.035) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
      className="w-full"
    >
      {/* Header */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-10 py-4"
        style={{ borderBottom: `1px solid ${C.hairline}` }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{ background: C.green, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, letterSpacing: "0.04em" }}
            className="px-2.5 py-1.5 rounded"
          >
            ROSHN
          </div>
          <div style={{ borderLeft: `1px solid ${C.hairline}`, height: 22 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>
            Alarous <span style={{ color: C.inkSoft, fontWeight: 500 }}>· Buyer Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saving && (
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }} className="flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> saving…
            </span>
          )}
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft }} className="hidden sm:flex items-center gap-2">
            <span>{unitData.buyerName}</span>
            <span style={{ color: C.hairline }}>/</span>
            <span style={{ color: C.green, fontWeight: 700 }}>{unitData.unitId}</span>
          </div>
          <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${C.hairline}` }}>
            <button
              onClick={() => setView("buyer")}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                padding: "6px 10px",
                background: view === "buyer" ? C.green : "#fff",
                color: view === "buyer" ? "#fff" : C.inkSoft,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Eye size={12} /> BUYER
            </button>
            <button
              onClick={() => setView("team")}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                padding: "6px 10px",
                background: view === "team" ? C.green : "#fff",
                color: view === "team" ? "#fff" : C.inkSoft,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Users size={12} /> SITE TEAM
            </button>
          </div>
        </div>
      </header>

      {/* Unit switcher (site team only) */}
      {view === "team" && (
        <div className="px-5 sm:px-10 py-3 flex items-center gap-2 flex-wrap" style={{ borderBottom: `1px solid ${C.hairline}`, background: "#FBF8F0" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>UNIT ID</span>
          <input
            value={unitIdInput}
            onChange={(e) => setUnitIdInput(e.target.value.toUpperCase())}
            style={{ ...inputStyle, width: 140 }}
          />
          <button
            onClick={() => setUnitId(unitIdInput || DEFAULT_UNIT_ID)}
            style={{ fontFamily: FONT_MONO, fontSize: 11, background: C.green, color: "#fff", padding: "6px 10px", borderRadius: 4 }}
          >
            LOAD / CREATE
          </button>
          <button
            onClick={resetDemo}
            style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, padding: "6px 10px", borderRadius: 4, border: `1px solid ${C.hairline}`, background: "#fff" }}
            className="flex items-center gap-1"
          >
            <RotateCcw size={11} /> RESET DEMO DATA
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 px-5 sm:px-10 py-10 items-center max-w-6xl mx-auto">
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.coral, letterSpacing: "0.05em" }}>
            {unitData.project.toUpperCase()} · {unitData.block.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }} className="text-4xl sm:text-5xl">
            Your villa is <span style={{ color: C.green }}>{OVERALL}%</span> built.
          </h1>
          <p style={{ color: C.inkSoft, marginTop: 14, maxWidth: 420, fontSize: 15, lineHeight: 1.6 }}>
            Currently in <strong style={{ color: C.ink }}>{currentPhase.label}</strong>. Estimated handover
            remains on track for <strong style={{ color: C.ink }}>{unitData.estimatedHandover}</strong>.
          </p>
          <div className="flex gap-8 mt-8">
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>UNIT</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18 }}>{unitData.unitId}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>PLOT</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18 }}>{unitData.plot}</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft }}>HANDOVER</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18 }}>{unitData.estimatedHandover}</div>
            </div>
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.hairline}`, borderRadius: 6 }} className="p-6">
          <VillaProgressElevation percent={OVERALL} />
        </div>
      </section>

      {/* Timeline */}
      <section className="px-5 sm:px-10 py-10 max-w-6xl mx-auto">
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22 }}>Construction timeline</h2>
        <p style={{ color: C.inkSoft, fontSize: 14, marginTop: 4 }}>
          Five phases, in build order. Payment milestones align with each stage under the Wafi off-plan sale program.
        </p>

        <div className="mt-8 flex flex-col gap-0">
          {displayPhases.map((phase, i) => {
            const Icon = ICONS[phase.icon];
            return (
              <div key={phase.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: phase.status === "upcoming" ? "#EFEBE0" : C.greenSoft,
                      border: `1px solid ${phase.status === "done" ? C.green : C.hairline}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: phase.status === "upcoming" ? C.inkSoft : C.green,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={17} />
                  </div>
                  {i < displayPhases.length - 1 && <div style={{ width: 1, flex: 1, background: C.hairline, minHeight: 28 }} />}
                </div>
                <div className="pb-8 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15 }}>{phase.label}</span>
                    <StatusBadge status={phase.status} />
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.inkSoft, marginTop: 4 }}>{phase.date}</div>
                  <div style={{ marginTop: 8, height: 6, background: "#EFEBE0", borderRadius: 3, overflow: "hidden", maxWidth: 320 }}>
                    <div style={{ width: `${phase.percent}%`, height: "100%", background: phase.status === "done" ? C.green : C.coral }} />
                  </div>

                  {view === "team" && (
                    <div className="flex items-center gap-3 mt-3 max-w-sm">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={phase.percent}
                        onChange={(e) => savePhasePercent(phase.key, Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontFamily: FONT_MONO, fontSize: 12, width: 36, color: C.coral, fontWeight: 700 }}>
                        {phase.percent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Updates */}
      <section className="px-5 sm:px-10 py-10 max-w-6xl mx-auto">
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 22 }}>Site updates</h2>
        <p style={{ color: C.inkSoft, fontSize: 14, marginTop: 4 }}>Latest notes logged from the site team.</p>

        {view === "team" && (
          <div style={{ background: C.card, border: `1px solid ${C.hairline}`, borderRadius: 6 }} className="p-4 mt-6 max-w-xl">
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>ADD SITE UPDATE</div>
            <div className="flex flex-col gap-3">
              <Field label="TITLE">
                <input
                  style={inputStyle}
                  value={newUpdate.title}
                  onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                  placeholder="e.g. Tiling completed in living areas"
                />
              </Field>
              <Field label="NOTE">
                <textarea
                  style={{ ...inputStyle, minHeight: 60 }}
                  value={newUpdate.note}
                  onChange={(e) => setNewUpdate({ ...newUpdate, note: e.target.value })}
                  placeholder="Details for the buyer"
                />
              </Field>
              <button
                onClick={addUpdate}
                style={{ fontFamily: FONT_MONO, fontSize: 12, background: C.coral, color: "#fff", padding: "8px 12px", borderRadius: 4, alignSelf: "flex-start" }}
                className="flex items-center gap-1"
              >
                <Plus size={13} /> POST UPDATE
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {updates.map((u, idx) => (
            <div key={idx} style={{ background: C.card, border: `1px solid ${C.hairline}`, borderRadius: 6 }} className="overflow-hidden">
              <div
                style={{
                  height: 110,
                  background: C.greenSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.green,
                  borderBottom: `1px solid ${C.hairline}`,
                }}
              >
                <Camera size={22} />
              </div>
              <div className="p-4">
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.coral }}>{u.date}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, marginTop: 4 }}>{u.title}</div>
                {u.note && <div style={{ color: C.inkSoft, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{u.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Villa details + support */}
      <section className="px-5 sm:px-10 py-10 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div style={{ background: C.card, border: `1px solid ${C.hairline}`, borderRadius: 6 }} className="p-6">
          <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 17 }}>Villa & purchase details</h3>

          {view === "team" ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="BUYER NAME">
                <input style={inputStyle} value={unitData.buyerName} onChange={(e) => saveUnitData({ ...unitData, buyerName: e.target.value })} />
              </Field>
              <Field label="VILLA TYPE">
                <input style={inputStyle} value={unitData.villaType} onChange={(e) => saveUnitData({ ...unitData, villaType: e.target.value })} />
              </Field>
              <Field label="PLOT AREA">
                <input style={inputStyle} value={unitData.plot} onChange={(e) => saveUnitData({ ...unitData, plot: e.target.value })} />
              </Field>
              <Field label="BUILT-UP AREA">
                <input style={inputStyle} value={unitData.builtUp} onChange={(e) => saveUnitData({ ...unitData, builtUp: e.target.value })} />
              </Field>
              <Field label="FLOORS">
                <input style={inputStyle} value={unitData.floors} onChange={(e) => saveUnitData({ ...unitData, floors: e.target.value })} />
              </Field>
              <Field label="ORIENTATION">
                <input style={inputStyle} value={unitData.orientation} onChange={(e) => saveUnitData({ ...unitData, orientation: e.target.value })} />
              </Field>
              <Field label="PURCHASE DATE">
                <input style={inputStyle} value={unitData.purchaseDate} onChange={(e) => saveUnitData({ ...unitData, purchaseDate: e.target.value })} />
              </Field>
              <Field label="ESTIMATED HANDOVER">
                <input style={inputStyle} value={unitData.estimatedHandover} onChange={(e) => saveUnitData({ ...unitData, estimatedHandover: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="mt-2">
              <DetailRow icon={Home} label="VILLA TYPE" value={unitData.villaType} />
              <DetailRow icon={Ruler} label="PLOT / BUILT-UP AREA" value={`${unitData.plot} · ${unitData.builtUp}`} />
              <DetailRow icon={Building2} label="FLOORS" value={unitData.floors} />
              <DetailRow icon={Compass} label="ORIENTATION" value={unitData.orientation} />
              <DetailRow icon={Calendar} label="PURCHASE DATE" value={unitData.purchaseDate} />
              <DetailRow icon={MapPin} label="LOCATION" value={`${unitData.block}, ${unitData.project}, ${unitData.city}`} />
            </div>
          )}
        </div>

        <div style={{ background: C.green, borderRadius: 6, color: "#fff" }} className="p-6 flex flex-col justify-between">
          <div>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 17 }}>Need to talk to someone?</h3>
            <p style={{ opacity: 0.85, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              Your customer relations manager can walk through the schedule, payment milestones, or site visit requests.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2" style={{ fontFamily: FONT_MONO, fontSize: 13 }}>
              <Phone size={15} /> 800 000 0000
            </div>
            <div className="flex items-center gap-2" style={{ fontFamily: FONT_MONO, fontSize: 13 }}>
              <Mail size={15} /> care@roshn.sa
            </div>
          </div>
        </div>
      </section>

      <footer className="px-5 sm:px-10 py-6 text-center" style={{ borderTop: `1px solid ${C.hairline}`, color: C.inkSoft, fontSize: 12, fontFamily: FONT_MONO }}>
        Demo data is stored in this browser's local storage only (not shared across devices). Swap the
        storage helpers for real API calls — see backend_data_model.md — to go live.
      </footer>
    </div>
  );
}
