// Mood Tape player: shelves stream ad-free music from Audius, pasted links play through Spotify's player,
// and files play straight from your device. Logs the mood of every song you listen to (30 seconds or more).

const $ = id => document.getElementById(id);
const data = loadData();
const LISTEN_SECONDS = 30;
const DEFAULT_TINT = "#3CC6E8";

let shelfId = SHELVES[0].id;     // shelf shown in the tabs
let queue = null;                // { shelfId, index } for prev/next
let current = null;              // { src: "sp" | "audio", song: {t, a, sp?, aud?, mood}, counted, heard }
const AUDIUS = "https://api.audius.co/v1";
const APP = "MoodTape";
let SpotifyAPI = null, sp = null, pendingUri = null;   // Spotify embed controller
let spState = { pos: 0, dur: 0, paused: true };
let playing = false;
let byoMood = "happy";
let errorsInARow = 0;

if (location.protocol === "file:") $("fileWarn").hidden = false;

/* ---------- helpers ---------- */
const fmt = s => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
const shelfById = id => SHELVES.find(s => s.id === id) || (id === "links" ? linksShelf() : null);
data.links = data.links.filter(l => l.sp);   // drop old YouTube links from earlier versions
function linksShelf(){ return { id: "links", name: "Your links", mood: null, blurb: "Songs you pasted from Spotify.", songs: data.links }; }
function songMood(shelf, song){ return song.mood || shelf.mood; }
// Turns a Spotify link (track, album or playlist) into a Spotify URI like "spotify:track:abc123".
function parseSpotify(text){
  const t = text.trim();
  let m = t.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]{10,})$/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  try {
    const u = new URL(t);
    if (!/(^|\.)spotify\.com$/.test(u.hostname)) return null;
    m = u.pathname.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]{10,})/);
    return m ? `spotify:${m[1]}:${m[2]}` : null;
  } catch (e) { return null; }
}
const spotifyUrl = uri => { const [, type, id] = uri.split(":"); return `https://open.spotify.com/${type}/${id}`; };

/* ---------- Audius (free, ad-free music) ---------- */
async function loadShelf(shelf){
  if (shelf.songs || shelf.loading) return;
  shelf.loading = true; shelf.failed = false;
  try {
    const r = await fetch(`${AUDIUS}/tracks/trending?app_name=${APP}&time=allTime&genre=${encodeURIComponent(shelf.genre)}`);
    if (!r.ok) throw new Error(r.status);
    const json = await r.json();
    shelf.songs = json.data
      .filter(t => t.is_streamable !== false && !t.stream_conditions && t.duration > 45 && /[a-z]{3}/i.test(t.title))
      .slice(0, 20)
      .map(t => ({ t: t.title, a: t.user && t.user.name, aud: t.id, link: t.permalink ? "https://audius.co" + t.permalink : "https://audius.co" }));
  } catch (e) { shelf.failed = true; }
  shelf.loading = false;
}
const streamUrl = id => `${AUDIUS}/tracks/${id}/stream?app_name=${APP}`;

/* ---------- the see-through cassette ---------- */
function clearCassetteSVG(o){
  const { title = "", sub = "", ring = "#FF4F6D", stripes = [] } = o;
  const t = title.length > 26 ? title.slice(0, 25) + "…" : title;
  const s = sub.length > 44 ? sub.slice(0, 43) + "…" : sub;
  const bw = 300, w = stripes.length ? bw / stripes.length : bw;
  const band = stripes.length
    ? stripes.map((c, i) => `<rect x="${(50 + i * w).toFixed(2)}" y="58" width="${(w + .4).toFixed(2)}" height="6" fill="${c}"/>`).join("")
    : "";
  const hub = (cx, k) => `
    <circle cx="${cx}" cy="128" r="25" fill="none" stroke="${ring}" stroke-width="5"/>
    <g class="hub hub-${k}">
      <circle cx="${cx}" cy="128" r="17" fill="#F1F5F8"/>
      ${[0, 60, 120, 180, 240, 300].map(a => `<rect x="${cx - 2}" y="113" width="4" height="7" rx="1.5" fill="#2A2E36" transform="rotate(${a} ${cx} 128)"/>`).join("")}
      <circle cx="${cx}" cy="128" r="5" fill="#2A2E36"/>
    </g>`;
  const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="#3A3F48"/><circle cx="${x - 1.5}" cy="${y - 1.5}" r="2" fill="rgba(255,255,255,.35)"/><path d="M${x - 3.5} ${y} H${x + 3.5}" stroke="#15181D" stroke-width="1.4"/>`;
  return `<svg viewBox="0 0 400 256" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cassette: ${esc(title)}">
  <defs>
    <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
  </defs>
  <rect x="4" y="4" width="392" height="248" rx="14" fill="rgba(235,248,255,.22)" stroke="rgba(255,255,255,.85)" stroke-width="2"/>
  <rect x="14" y="14" width="372" height="228" rx="10" fill="none" stroke="rgba(255,255,255,.35)"/>
  <rect x="34" y="20" width="332" height="34" rx="4" fill="rgba(255,255,255,.88)"/>
  <text x="46" y="43" font-family="'Permanent Marker', cursive" font-size="17" fill="#1C2630">${esc(t)}</text>
  <text x="354" y="34" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="8" font-weight="600" fill="#6B7783">C-60</text>
  <text x="354" y="47" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="8" fill="#6B7783">${esc(s)}</text>
  ${band}
  <path d="M44 72 H356 Q366 72 366 82 V176 Q366 186 356 186 H44 Q34 186 34 176 V82 Q34 72 44 72 Z" fill="#1A1D23" opacity=".93"/>
  <rect x="168" y="104" width="64" height="40" rx="6" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.3)"/>
  <path d="M172 136 H228" stroke="#5B3D2E" stroke-width="3"/>
  ${hub(122, "l")}${hub(278, "r")}
  <path d="M86 252 L106 200 H294 L314 252" fill="rgba(235,248,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>
  <circle cx="134" cy="228" r="7" fill="rgba(20,30,40,.55)"/><circle cx="266" cy="228" r="7" fill="rgba(20,30,40,.55)"/>
  <rect x="176" y="218" width="14" height="12" rx="2" fill="rgba(20,30,40,.55)"/><rect x="210" y="218" width="14" height="12" rx="2" fill="rgba(20,30,40,.55)"/>
  ${screw(22, 22)}${screw(378, 22)}${screw(22, 234)}${screw(378, 234)}${screw(200, 196)}
  <rect x="4" y="4" width="392" height="248" rx="14" fill="url(#glare)" pointer-events="none"/>
</svg>`;
}

function drawCassette(){
  const mood = current ? MOOD[current.song.mood] : null;
  const box = $("cassette");
  box.innerHTML = clearCassetteSVG({
    title: current ? current.song.t : "Mood Tape",
    sub: current ? (current.song.a || "") : "side A",
    ring: mood ? mood.color : "#FF4F6D",
    stripes: stripeColors(listensIn(data, monthKey(new Date())))
  });
  box.classList.toggle("playing", playing);
}
function setPlaying(on){
  playing = on;
  $("cassette").classList.toggle("playing", on);
  $("playIcon").innerHTML = on ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
  $("playBtn").setAttribute("aria-label", on ? "Pause" : "Play");
}

/* ---------- now playing ---------- */
function showNow(){
  if (!current) return;
  const m = MOOD[current.song.mood];
  $("nowTitle").textContent = current.song.t;
  const via = current.song.link ? ` · <a href="${esc(current.song.link)}" target="_blank" rel="noopener" style="color:inherit">on ${current.song.aud ? "Audius" : "Spotify"} ↗</a>` : "";
  $("nowArtist").innerHTML = `${esc(current.song.a || "")}${current.song.a ? " · " : ""}${m.label} stripe${via}`;
  $("moodNow").textContent = `mood: ${m.label.toLowerCase()}`;
  $("masking").textContent = m.label.toLowerCase();
  document.documentElement.style.setProperty("--tint", m.color);
  document.title = `${current.song.t} · Mood Tape`;
  drawCassette();
  renderSongs();
}

/* ---------- the little player window (only for pasted Spotify links) ---------- */
function showTV(on){ $("tv").hidden = !on; }
function tvSay(html){
  const el = $("screenOff");
  if (html === null){ el.hidden = true; return; }
  el.innerHTML = html; el.hidden = false;
}

/* ---------- playing things ---------- */
function stopAll(){
  try { if (sp) sp.pause(); } catch (e) {}
  $("audio").pause();
}
function playSong(shelf, index){
  const song = shelf.songs[index];
  if (!song) return;
  queue = { shelfId: shelf.id, index };
  if (song.aud){
    // Audius: plain audio, no video player and no ads
    try { if (sp) sp.pause(); } catch (e) {}
    showTV(false);
    current = { src: "audio", song: { ...song, mood: songMood(shelf, song) }, counted: false, heard: 0 };
    showNow();
    const a = $("audio"); a.src = streamUrl(song.aud);
    a.play().catch(() => {});
    return;
  }
  current = { src: "sp", song: { ...song, mood: songMood(shelf, song) }, counted: false, heard: 0 };
  $("audio").pause();
  showTV(true);
  showNow();
  spPlay(song.sp);
}
function playFile(file){
  stopAll();
  const a = $("audio");
  if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
  const url = URL.createObjectURL(file);
  a.dataset.url = url; a.src = url;
  queue = null;
  showTV(false);
  current = { src: "audio", song: { t: file.name.replace(/\.[^.]+$/, ""), a: "From your device", mood: byoMood }, counted: false, heard: 0 };
  showNow();
  a.play().catch(() => toast("This file type can't play here. Try an MP3."));
}
function step(dir){
  if (!queue) return;
  const shelf = shelfById(queue.shelfId);
  if (!shelf || !shelf.songs.length) return;
  playSong(shelf, (queue.index + dir + shelf.songs.length) % shelf.songs.length);
}
function toggle(){
  if (!current){ const sh = shelfById(shelfId); sh && sh.songs && sh.songs.length ? playSong(sh, 0) : open("shelves"); return; }
  if (current.src === "audio"){ const a = $("audio"); a.paused ? a.play() : a.pause(); return; }
  if (sp) sp.togglePlay();
}
function times(){
  if (!current) return { t: 0, d: 0 };
  if (current.src === "audio"){ const a = $("audio"); return { t: a.currentTime || 0, d: a.duration || 0 }; }
  return { t: spState.pos, d: spState.dur };
}
function seekTo(frac){
  const { d } = times(); if (!d) return;
  if (current.src === "audio") $("audio").currentTime = frac * d;
  else if (sp) sp.seek(frac * d);
}

/* ---------- logging moods ---------- */
function logListen(){
  if (!current || current.counted) return;
  current.counted = true;
  data.listens.push({ ts: Date.now(), mood: current.song.mood, t: current.song.t, a: current.song.a || "" });
  saveData(data);
  toast(`Added a ${MOOD[current.song.mood].label.toLowerCase()} stripe to your tape`);
  drawCassette(); renderMonth();
}

setInterval(() => {
  const { t, d } = times();
  $("tCur").textContent = fmt(t); $("tDur").textContent = fmt(d);
  $("fill").style.width = d ? `${Math.min(100, t / d * 100)}%` : "0";
  $("seek").setAttribute("aria-valuenow", d ? Math.round(t / d * 100) : 0);
  if (playing && current && !current.counted){
    current.heard += 0.5;
    if (current.heard >= LISTEN_SECONDS) logListen();
  }
}, 500);

/* ---------- Spotify (official embed player, no ads) ---------- */
// Spotify plays full songs for people logged in to Spotify in this browser, and 30-second previews for everyone else.
window.onSpotifyIframeApiReady = API => { SpotifyAPI = API; if (pendingUri){ const u = pendingUri; pendingUri = null; spPlay(u); } };
function spPlay(uri){
  spState = { pos: 0, dur: 0, paused: true };
  if (!SpotifyAPI){ pendingUri = uri; toast("Loading Spotify…"); return; }
  if (sp){ sp.loadUri(uri); sp.play(); return; }
  SpotifyAPI.createController($("sp"), { uri, width: "100%", height: 152 }, ctl => {
    sp = ctl;
    ctl.addListener("ready", () => ctl.play());
    ctl.addListener("playback_update", e => {
      if (!current || current.src !== "sp") return;
      const { position, duration, isPaused } = e.data;
      const ended = !isPaused && duration > 0 && position >= duration - 400;
      spState = { pos: position / 1000, dur: duration / 1000, paused: isPaused };
      setPlaying(!isPaused && !ended);
      if (ended && !current.ended){ current.ended = true; if (current.heard >= 10) logListen(); }
    });
  });
}

const audio = $("audio");
audio.addEventListener("play", () => { if (current && current.src === "audio") setPlaying(true); });
audio.addEventListener("pause", () => { if (current && current.src === "audio") setPlaying(false); });
audio.addEventListener("ended", () => { setPlaying(false); if (current && current.heard >= 10) logListen(); if (current && current.song.aud) step(1); });
audio.addEventListener("error", () => {
  if (!current || current.src !== "audio" || !audio.getAttribute("src")) return;
  setPlaying(false);
  if (current.song.aud){ toast("This song didn't load. Skipping it."); setTimeout(() => step(1), 1200); }
  else toast("This file type can't play here. Try an MP3.");
});

/* ---------- glass panels ---------- */
let openPanel = null, lastFocus = null;
function open(name){
  close();
  lastFocus = document.activeElement;
  openPanel = $("panel-" + name);
  if (name === "month") renderMonth();
  $("scrim").hidden = false; openPanel.hidden = false;
  (openPanel.querySelector("[aria-selected='true'], .x") || openPanel).focus();
}
function close(){
  if (!openPanel) return;
  openPanel.hidden = true; $("scrim").hidden = true; openPanel = null;
  if (lastFocus) lastFocus.focus();
}
document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => open(b.dataset.open)));
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", close));
$("scrim").addEventListener("click", close);

/* ---------- shelves ---------- */
function allShelves(){ return data.links.length ? [...SHELVES, linksShelf()] : SHELVES; }
function renderTabs(){
  $("tabs").innerHTML = allShelves().map(s => {
    const c = s.mood ? MOOD[s.mood].color : "#fff";
    return `<button class="tab" role="tab" aria-selected="${s.id === shelfId}" data-shelf="${s.id}"><i style="background:${c}"></i>${esc(s.name)}</button>`;
  }).join("");
}
function renderSongs(){
  const shelf = shelfById(shelfId);
  if (!shelf){ shelfId = SHELVES[0].id; return renderSongs(); }
  if (shelf.genre && !shelf.songs){
    $("blurb").textContent = shelf.blurb;
    $("songs").innerHTML = `<li class="note">${shelf.failed ? "Couldn't reach the music library. Check your internet and tap the shelf again." : "Tuning in…"}</li>`;
    if (!shelf.loading){ loadShelf(shelf).then(() => { if (shelfId === shelf.id) renderSongs(); }); }
    return;
  }
  $("blurb").textContent = shelf.mood ? `${shelf.blurb} Each song adds a ${MOOD[shelf.mood].label.toLowerCase()} stripe.` : shelf.blurb;
  $("songs").innerHTML = shelf.songs.map((s, i) => {
    const on = queue && queue.shelfId === shelf.id && queue.index === i;
    const c = MOOD[songMood(shelf, s)].color;
    return `<li><button class="song ${on ? "on" : ""}" data-i="${i}"><span class="n">${on && playing ? "♪" : pad(i + 1)}</span>
      <span><b>${esc(s.t)}</b><small>${esc(s.a || "")}</small></span><span class="dot" style="background:${c}"></span></button></li>`;
  }).join("");
}
$("tabs").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  shelfId = b.dataset.shelf;
  const sh = shelfById(shelfId); if (sh && sh.failed){ sh.failed = false; }
  renderTabs(); renderSongs();
});
$("songs").addEventListener("click", e => {
  const b = e.target.closest(".song"); if (!b) return;
  playSong(shelfById(shelfId), +b.dataset.i);
  close();
});

/* ---------- your music ---------- */
function moodChips(el, selected, attr){
  el.innerHTML = MOODS.map(m => `<button class="chip" data-${attr}="${m.id}" aria-pressed="${m.id === selected}"><i style="background:${m.color}"></i>${m.label}</button>`).join("");
}
moodChips($("byoMoods"), byoMood, "mood");
$("byoMoods").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  byoMood = b.dataset.mood; moodChips($("byoMoods"), byoMood, "mood");
});
$("linkForm").addEventListener("submit", e => {
  e.preventDefault();
  const uri = parseSpotify($("linkIn").value);
  if (!uri){ toast("That doesn't look like a Spotify link. In Spotify, tap Share → Copy link."); return; }
  let i = data.links.findIndex(l => l.sp === uri);
  if (i < 0){ data.links.push({ t: "Spotify link", a: "", sp: uri, link: spotifyUrl(uri), mood: byoMood }); i = data.links.length - 1; }
  else data.links[i].mood = byoMood;
  saveData(data);
  $("linkIn").value = "";
  shelfId = "links"; renderTabs();
  playSong(linksShelf(), i); close();
  // fetch the real song name from Spotify
  fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl(uri))}`).then(r => r.ok ? r.json() : null).then(o => {
    if (!o || !o.title) return;
    const l = data.links.find(x => x.sp === uri); if (l){ l.t = o.title; saveData(data); }
    if (current && current.song.sp === uri){ current.song.t = o.title; showNow(); }
    renderSongs();
  }).catch(() => {});
});
$("fileIn").addEventListener("change", e => { const f = e.target.files[0]; if (f){ playFile(f); close(); } e.target.value = ""; });

/* ---------- my month ---------- */
const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
function renderMonth(){
  const now = new Date(), mk = monthKey(now);
  const ls = listensIn(data, mk), cs = checkinsIn(data, mk);
  $("monthTitle").textContent = `${MONTH_NAMES[now.getMonth()]} so far`;
  const stripes = stripeColors(ls, 120);
  $("stripes").innerHTML = stripes.length ? stripes.map(c => `<i style="background:${c}"></i>`).join("") : `<span class="empty">Your stripes appear here after you listen for 30 seconds.</span>`;
  const counts = moodCounts(ls);
  $("insight").textContent = counts.length ? `Mostly ${counts[0].label.toLowerCase()} this month: ${counts[0].n} of ${ls.length} songs.` : "No songs on this month's tape yet.";
  $("legend").innerHTML = counts.map(m => `<span><i style="background:${m.color}"></i>${m.label} ${m.n}</span>`).join("");

  const days = daysInMonth(now), first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  let cal = "<span style='border:0'></span>".repeat(first);
  for (let d = 1; d <= days; d++){
    const tally = {};
    ls.forEach(l => { if (new Date(l.ts).getDate() === d) tally[l.mood] = (tally[l.mood] || 0) + 1; });
    cs.forEach(c => { if (new Date(c.ts).getDate() === d) tally[c.mood] = (tally[c.mood] || 0) + 3; });
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    cal += `<span class="${best ? "has" : ""} ${d === now.getDate() ? "today" : ""}" style="${best ? `background:${MOOD[best[0]].color}` : ""}" title="${best ? MOOD[best[0]].label : ""}">${d}</span>`;
  }
  $("cal").innerHTML = cal;

  const recent = [...data.listens].reverse().slice(0, 6);
  $("recent").innerHTML = recent.length ? recent.map(l => {
    const d = new Date(l.ts);
    return `<li><i style="background:${MOOD[l.mood].color}"></i><span>${esc(l.t)}</span><small>${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}</small></li>`;
  }).join("") : `<li class="none">Nothing yet. Play anything for 30 seconds.</li>`;
}
moodChips($("checkin"), null, "check");
$("checkin").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  data.checkins.push({ ts: Date.now(), mood: b.dataset.check });
  saveData(data); renderMonth();
  toast(`Noted: feeling ${MOOD[b.dataset.check].label.toLowerCase()} today`);
});

/* ---------- controls ---------- */
$("cassette").addEventListener("click", () => current ? toggle() : open("shelves"));
$("cassette").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); current ? toggle() : open("shelves"); } });
$("playBtn").onclick = toggle;
$("prevBtn").onclick = () => step(-1);
$("nextBtn").onclick = () => step(1);
$("seek").addEventListener("click", e => { const r = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width); });
$("seek").addEventListener("keydown", e => {
  const { t, d } = times(); if (!d) return;
  if (e.key === "ArrowRight"){ e.preventDefault(); seekTo(Math.min(1, (t + 5) / d)); }
  if (e.key === "ArrowLeft"){ e.preventDefault(); seekTo(Math.max(0, (t - 5) / d)); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){ close(); return; }
  if (e.code === "Space" && !/INPUT|BUTTON|TEXTAREA|A/.test(document.activeElement.tagName)){ e.preventDefault(); toggle(); }
});

$("suggestBtn").onclick = () => {
  if (CONFIG.suggestUrl){ window.open(CONFIG.suggestUrl, "_blank", "noopener"); return; }
  location.href = `mailto:${CONFIG.suggestEmail}?subject=${encodeURIComponent("Song suggestion for Mood Tape")}&body=${encodeURIComponent("Song:\nArtist:\nWhich shelf should it go on?\n")}`;
};

/* ---------- start ---------- */
document.documentElement.style.setProperty("--tint", DEFAULT_TINT);
renderTabs(); renderSongs(); drawCassette(); renderMonth();
