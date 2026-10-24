// Shared by the player (index.html) and the print studio (print.html).

const CONFIG = {
  // Paste your Tally or Google Form link here to collect song suggestions.
  // While it's empty, the "Suggest a song" button opens an email instead.
  suggestUrl: "",
  suggestEmail: "kavya5j3@gmail.com"
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MOOD = Object.fromEntries(MOODS.map(m => [m.id, m]));
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/* ---------- storage (lives in this browser only, no backend) ---------- */
const STORE_KEY = "moodtape.v2";
function loadData(){
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
  if (!d || !Array.isArray(d.listens)) d = { listens: [], checkins: [], links: [], name: "" };
  d.checkins = d.checkins || []; d.links = d.links || [];
  return d;
}
function saveData(d){ try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }

function listensIn(d, mk){ return d.listens.filter(l => monthKey(new Date(l.ts)) === mk); }
function checkinsIn(d, mk){ return d.checkins.filter(c => monthKey(new Date(c.ts)) === mk); }
function moodCounts(items){
  const c = Object.fromEntries(MOODS.map(m => [m.id, 0]));
  items.forEach(i => { if (c[i.mood] !== undefined) c[i.mood]++; });
  return MOODS.map(m => ({ ...m, n: c[m.id] })).filter(m => m.n).sort((a, b) => b.n - a.n);
}
// One color per listen, in order. Long months get squeezed into at most `max` stripes.
function stripeColors(items, max = 60){
  const cols = items.map(i => (MOOD[i.mood] || MOODS[0]).color);
  if (cols.length <= max) return cols;
  const out = [];
  for (let i = 0; i < max; i++) out.push(cols[Math.floor(i * cols.length / max)]);
  return out;
}

/* ---------- the cassette ---------- */
function cassetteSVG(o){
  const { title = "", sub = "", color = "#E9E6DD", stripes = [], rl = 22, rr = 10, side = "A", uid = "c", cls = "" } = o;
  const t = title.length > 24 ? title.slice(0, 23) + "…" : title;
  const s = sub.length > 40 ? sub.slice(0, 39) + "…" : sub;
  const bandW = 316, w = stripes.length ? bandW / stripes.length : bandW;
  const band = stripes.length
    ? stripes.map((c, i) => `<rect x="${(42 + i * w).toFixed(2)}" y="150" width="${(w + 0.4).toFixed(2)}" height="12" fill="${c}"/>`).join("")
    : `<rect x="42" y="150" width="${bandW}" height="12" fill="rgba(0,0,0,.12)"/>`;
  const hub = (cx, k) => `<g class="hub hub-${k}"><circle cx="${cx}" cy="112" r="11" fill="#F4F1E8"/>${[0, 60, 120, 180, 240, 300].map(a =>
    `<rect x="${cx - 1.7}" y="101.5" width="3.4" height="5.5" rx="1" fill="#26272E" transform="rotate(${a} ${cx} 112)"/>`).join("")}<circle cx="${cx}" cy="112" r="3.4" fill="#26272E"/></g>`;
  const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="5.5" fill="url(#${uid}-screw)"/><path d="M${x - 3.2} ${y - 1} L${x + 3.2} ${y + 1}" stroke="#15161A" stroke-width="1.4"/>`;
  return `<svg class="cassette ${cls}" viewBox="0 0 400 256" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cassette: ${esc(title)}">
  <defs>
    <linearGradient id="${uid}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B3E48"/><stop offset="1" stop-color="#23252C"/></linearGradient>
    <linearGradient id="${uid}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1C22"/><stop offset="1" stop-color="#0E0F13"/></linearGradient>
    <radialGradient id="${uid}-screw"><stop offset="0" stop-color="#9A9DA8"/><stop offset="1" stop-color="#4A4D57"/></radialGradient>
    <linearGradient id="${uid}-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="4" y="4" width="392" height="248" rx="16" fill="url(#${uid}-body)"/>
  <rect x="4.5" y="4.5" width="391" height="247" rx="15.5" fill="none" stroke="rgba(255,255,255,.10)"/>
  ${screw(18, 18)}${screw(382, 18)}${screw(18, 238)}${screw(382, 238)}
  <rect x="30" y="18" width="340" height="156" rx="8" fill="${color}"/>
  <rect x="42" y="28" width="316" height="48" rx="3" fill="#F7F5EE"/>
  <path d="M52 56 H348 M52 68 H348" stroke="rgba(30,30,36,.10)"/>
  <text x="52" y="54" font-family="'Permanent Marker', 'Marker Felt', cursive" font-size="21" fill="#1E1E24">${esc(t)}</text>
  <text x="52" y="70" font-family="'IBM Plex Mono', monospace" font-size="9.5" fill="#55575F">${esc(s)}</text>
  <text x="346" y="44" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="9" font-weight="600" fill="#8A8C94">C-60</text>
  <circle cx="58" cy="112" r="15" fill="rgba(255,255,255,.85)"/>
  <text x="58" y="119" text-anchor="middle" font-family="'Bricolage Grotesque', sans-serif" font-size="20" font-weight="800" fill="#1E1E24">${side}</text>
  ${band}
  <rect x="110" y="84" width="180" height="56" rx="28" fill="url(#${uid}-glass)"/>
  <circle class="tapeL" cx="152" cy="112" r="${rl.toFixed(1)}" fill="#3E2A20"/>
  <circle class="tapeR" cx="248" cy="112" r="${rr.toFixed(1)}" fill="#3E2A20"/>
  <path d="M138 136 Q200 142 262 136" stroke="#3E2A20" stroke-width="2" fill="none" opacity=".8"/>
  ${hub(152, "l")}${hub(248, "r")}
  <rect x="110" y="84" width="180" height="56" rx="28" fill="url(#${uid}-shine)"/>
  <rect x="110.5" y="84.5" width="179" height="55" rx="27.5" fill="none" stroke="rgba(255,255,255,.14)"/>
  <path d="M82 252 L104 190 H296 L318 252 Z" fill="#2C2E36"/>
  <path d="M104 190 H296" stroke="rgba(255,255,255,.08)"/>
  <circle cx="130" cy="226" r="7.5" fill="#121317"/><circle cx="270" cy="226" r="7.5" fill="#121317"/>
  <rect x="172" y="214" width="15" height="13" rx="2" fill="#121317"/><rect x="213" y="214" width="15" height="13" rx="2" fill="#121317"/>
  <rect x="4" y="4" width="392" height="248" rx="16" fill="url(#${uid}-shine)" pointer-events="none"/>
</svg>`;
}
