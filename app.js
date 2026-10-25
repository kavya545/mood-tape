// Mood Tape: drag a real cassette into the deck to play it.
// Songs: ad-free Audius shelves, Spotify links, or files from your device.
// Every song you listen to for 30 seconds adds a mood stripe to your month.

const $ = id => document.getElementById(id);
const data = loadData();
const LISTEN_SECONDS = 30;
const DEFAULT_MOOD_LIGHT = "#E8DCC4";
const AUDIUS = "https://api.audius.co/v1";
const APP = "MoodTape";

let shelfId = SHELVES[0].id;     // shelf shown in the Shelves panel
let queue = null;                // { shelfId, index } so rewind / fast-forward can move between songs
let current = null;              // { src: "audio" | "sp", song, counted, heard }
let inserted = false, busy = false, playing = false;
let SpotifyAPI = null, sp = null, pendingUri = null;
let spState = { pos: 0, dur: 0, paused: true };
let byoMood = "happy";

const tape = $("tape"), deck = $("deck"), audio = $("audio");
if (location.protocol === "file:") $("fileWarn").hidden = false;

/* ---------- helpers ---------- */
const fmt = s => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
const wait = ms => new Promise(r => setTimeout(r, ms));
data.links = data.links.filter(l => l.sp);
function linksShelf(){ return { id: "links", name: "Your links", mood: null, blurb: "Songs you pasted from Spotify.", songs: data.links }; }
const shelfById = id => SHELVES.find(s => s.id === id) || (id === "links" ? linksShelf() : null);
const songMood = (shelf, song) => song.mood || shelf.mood;
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

/* ---------- Audius shelves ---------- */
async function loadShelf(shelf){
  if (shelf.songs || shelf.loading) return shelf.loading;
  shelf.failed = false;
  shelf.loading = (async () => {
    try {
      const r = await fetch(`${AUDIUS}/tracks/trending?app_name=${APP}&time=allTime&genre=${encodeURIComponent(shelf.genre)}`);
      if (!r.ok) throw new Error(r.status);
      const json = await r.json();
      shelf.songs = json.data
        .filter(t => t.is_streamable !== false && !t.stream_conditions && t.duration > 45 && /[a-z]{3}/i.test(t.title) && /[aeiou]/i.test(t.title))
        .slice(0, 20)
        .map(t => ({ t: t.title, a: t.user && t.user.name, aud: t.id, link: t.permalink ? "https://audius.co" + t.permalink : "https://audius.co" }));
    } catch (e) { shelf.failed = true; }
    shelf.loading = null;
  })();
  return shelf.loading;
}
const streamUrl = id => `${AUDIUS}/tracks/${id}/stream?app_name=${APP}`;

/* ---------- layout: where the tape sits ---------- */
function place(){
  const st = $("stage").getBoundingClientRect();
  let left, top, w;
  if (inserted){
    const s = $("slot").getBoundingClientRect();
    w = Math.min(s.width * .94, s.height * .94 * 1098 / 700);
    left = s.left - st.left + (s.width - w) / 2;
    top = s.top - st.top + (s.height - w * 700 / 1098) / 2;
  } else {
    const a = $("anchor").getBoundingClientRect();
    w = Math.max(120, Math.min(420, a.width * .82, a.height * .8 * 1098 / 700));
    left = a.left - st.left + (a.width - w) / 2;
    top = a.top - st.top + (a.height - w * 700 / 1098) / 2;
  }
  tape.style.width = w + "px"; tape.style.left = left + "px"; tape.style.top = top + "px";
  const s = $("slot"), d = $("door");
  Object.assign(d.style, { left: s.offsetLeft + "px", top: s.offsetTop + "px", width: s.offsetWidth + "px", height: s.offsetHeight + "px" });
}
addEventListener("resize", place);

/* ---------- the label, caption and mood light ---------- */
function writeLabel(text){
  const ink = $("ink");
  ink.classList.add("wiping");
  setTimeout(() => { ink.textContent = text.toLowerCase(); ink.classList.remove("wiping"); }, 260);
}
function showNow(){
  if (!current) return;
  const m = MOOD[current.song.mood], s = current.song;
  document.documentElement.style.setProperty("--mood", m.color);
  document.body.classList.add("has-song");
  writeLabel(s.t);
  $("nowTitle").textContent = s.t;
  const via = s.link ? ` · <a href="${esc(s.link)}" target="_blank" rel="noopener">on ${s.aud ? "Audius" : "Spotify"} ↗</a>` : "";
  $("nowArtist").innerHTML = `${esc(s.a || "")}${via}`;
  $("moodLine").innerHTML = `<i></i>${m.label}`;
  $("bigTitle").textContent = s.t;
  $("bigArtist").textContent = s.a || "";
  $("bigMeta").textContent = `Now playing · ${m.label} · side A`;
  document.title = `${s.t} · Mood Tape`;
  renderSongs();
}

/* ---------- loading a song onto the tape (doesn't play until it's in the deck) ---------- */
function setSong(song, mood, q){
  stopAll();
  queue = q || null;
  current = { src: song.sp ? "sp" : "audio", song: { ...song, mood }, counted: false, heard: 0 };
  $("tv").hidden = current.src !== "sp";
  if (current.src === "audio") audio.src = song.aud ? streamUrl(song.aud) : song.file;
  showNow();
}
function stopAll(){ try { if (sp) sp.pause(); } catch (e) {} audio.pause(); }
function start(){
  if (!current || !inserted) return;
  if (current.src === "audio"){ SFX.attach(audio); audio.play().catch(() => toast("Tap play on the deck to start.")); }
  else spPlay(current.song.sp);
}
async function pickDefault(){
  const shelf = SHELVES[0];
  await loadShelf(shelf);
  if (shelf.songs && shelf.songs.length) setSong(shelf.songs[0], shelf.mood, { shelfId: shelf.id, index: 0 });
}
// choosing a song while a tape is playing: pop the old one out, write the new label, slide it back in
async function choose(song, mood, q){
  if (inserted){ eject(); await wait(650); }
  setSong(song, mood, q);
  await wait(950);
  insert();
}

/* ---------- the moment: insert + eject ---------- */
async function insert(){
  if (inserted || busy) return;
  busy = true;
  if (!current){ $("nowArtist").textContent = "Finding a song…"; await pickDefault(); }
  if (!current){ busy = false; toast("Couldn't reach the music library. Try Your music instead."); return; }
  inserted = true;
  tape.classList.remove("out"); tape.classList.add("in");
  tape.style.translate = "0px 0px";
  document.body.classList.add("inserted");
  place();
  await wait(540);
  SFX.clunk();
  deck.classList.remove("shake"); void deck.offsetWidth; deck.classList.add("shake");
  await wait(360);
  busy = false;
  start();
}
function eject(){
  if (!inserted || busy) return;
  stopAll();
  SFX.eject();
  inserted = false;
  document.body.classList.remove("inserted");
  tape.classList.remove("in"); tape.classList.add("out", "pop");
  place();
  setTimeout(() => tape.classList.remove("pop"), 520);
}
function toggle(){
  if (!inserted){ toast("Put the tape in first"); deck.classList.remove("shake"); void deck.offsetWidth; deck.classList.add("shake"); return; }
  if (current.src === "audio"){ audio.paused ? (SFX.attach(audio), audio.play()) : audio.pause(); }
  else if (sp) sp.togglePlay();
}
// rewind / fast-forward: whirr, spin the reels fast, then the next song
let wind = 0, windDir = 1;
async function step(dir){
  if (!queue || busy) return;
  const shelf = shelfById(queue.shelfId);
  if (!shelf || !shelf.songs || !shelf.songs.length) return;
  busy = true;
  SFX.whirr(.65); wind = .65; windDir = dir;
  const i = (queue.index + dir + shelf.songs.length) % shelf.songs.length;
  stopAll();
  await wait(650);
  setSong(shelf.songs[i], songMood(shelf, shelf.songs[i]), { shelfId: shelf.id, index: i });
  busy = false;
  start();
}

/* ---------- dragging the tape ---------- */
let drag = null;
function overSlot(){
  const t = tape.getBoundingClientRect(), s = $("slot").getBoundingClientRect();
  const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
  return cx > s.left - 40 && cx < s.right + 40 && cy > s.top - 60 && cy < s.bottom + 40;
}
tape.addEventListener("pointerdown", e => {
  SFX.unlock();
  if (inserted || busy) return;
  drag = { x: e.clientX, y: e.clientY, moved: false };
  tape.setPointerCapture(e.pointerId);
  tape.classList.add("dragging");
});
tape.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 6) drag.moved = true;
  tape.style.translate = `${dx}px ${dy}px`;
  deck.classList.toggle("ready", overSlot());
});
function endDrag(){
  if (!drag) return;
  const moved = drag.moved, over = overSlot();
  drag = null;
  tape.classList.remove("dragging");
  deck.classList.remove("ready");
  if (!moved || over) insert();
  else { tape.style.translate = "0px 0px"; SFX.key(); }
}
tape.addEventListener("pointerup", endDrag);
tape.addEventListener("pointercancel", endDrag);
tape.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); e.stopPropagation(); inserted ? toggle() : insert(); } });
tape.addEventListener("click", () => { if (inserted && !busy) toggle(); });

/* ---------- reels, spotlight and VU meter react to the music ---------- */
const VU_N = 12;
$("vu").innerHTML = Array.from({ length: VU_N }, () => "<i></i>").join("");
const vuEls = [...$("vu").children];
let angL = 0, angR = 0, lastT = performance.now();
function fakeLevels(t){   // Spotify won't share its audio, so its reels follow a gentle made-up pulse
  const s = t / 1000;
  return { bass: .3 + .3 * Math.max(0, Math.sin(s * Math.PI * 3.6)) ** 6, all: .35 + .15 * Math.sin(s * 5.3) * Math.sin(s * 1.7) };
}
function frame(t){
  const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
  let lv = { bass: 0, all: 0 };
  if (playing) lv = current && current.src === "audio" ? SFX.levels() : fakeLevels(t);
  let speed = playing ? 2.4 * (1 + lv.bass * .7) : 0;
  if (wind > 0){ speed = 26 * windDir; wind -= dt; }
  angL -= speed * dt; angR -= speed * dt * .93;
  $("hubL").style.transform = `rotate(${angL}rad)`;
  $("hubR").style.transform = `rotate(${angR}rad)`;
  document.documentElement.style.setProperty("--spot", (inserted ? .55 : 1) + lv.bass * .6);
  const n = Math.min(VU_N, Math.round(lv.all * 2.2 * VU_N));
  vuEls.forEach((el, i) => { el.className = i < n ? (i >= VU_N - 2 ? "on peak" : i >= VU_N - 5 ? "on hot" : "on") : ""; });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function setPlaying(on){
  playing = on;
  document.body.classList.toggle("playing", on);
  $("playIcon").innerHTML = on ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M7 5v14l12-7z"/>';
  $("playBtn").setAttribute("aria-label", on ? "Pause" : "Play");
  on ? SFX.hissOn() : SFX.hissOff();
  renderSongs();
}

/* ---------- audio element ---------- */
audio.addEventListener("play", () => { if (current && current.src === "audio") setPlaying(true); });
audio.addEventListener("pause", () => { if (current && current.src === "audio") setPlaying(false); });
audio.addEventListener("ended", () => { setPlaying(false); if (current && current.heard >= 10) logListen(); step(1); });
audio.addEventListener("error", () => {
  if (!current || current.src !== "audio" || !audio.getAttribute("src") || !inserted) return;
  setPlaying(false);
  if (current.song.aud){ toast("This song didn't load. Skipping it."); setTimeout(() => step(1), 900); }
  else toast("This file type can't play here. Try an MP3.");
});

/* ---------- Spotify ---------- */
window.onSpotifyIframeApiReady = API => { SpotifyAPI = API; if (pendingUri){ const u = pendingUri; pendingUri = null; spPlay(u); } };
function spPlay(uri){
  spState = { pos: 0, dur: 0, paused: true };
  if (!SpotifyAPI){ pendingUri = uri; toast("Loading Spotify…"); return; }
  if (sp){ sp.loadUri(uri); sp.play(); return; }
  SpotifyAPI.createController($("sp"), { uri, width: "100%", height: 80 }, ctl => {
    sp = ctl;
    ctl.addListener("ready", () => { if (inserted) ctl.play(); });
    ctl.addListener("playback_update", e => {
      if (!current || current.src !== "sp") return;
      const { position, duration, isPaused } = e.data;
      const ended = !isPaused && duration > 0 && position >= duration - 400;
      spState = { pos: position / 1000, dur: duration / 1000, paused: isPaused };
      if (playing !== (!isPaused && !ended)) setPlaying(!isPaused && !ended);
      if (ended && !current.ended){ current.ended = true; if (current.heard >= 10) logListen(); }
    });
  });
}

/* ---------- time, progress and the 30-second listen ---------- */
function times(){
  if (!current) return { t: 0, d: 0 };
  if (current.src === "audio") return { t: audio.currentTime || 0, d: audio.duration || 0 };
  return { t: spState.pos, d: spState.dur };
}
function logListen(){
  if (!current || current.counted) return;
  current.counted = true;
  data.listens.push({ ts: Date.now(), mood: current.song.mood, t: current.song.t, a: current.song.a || "" });
  saveData(data);
  toast(`A ${MOOD[current.song.mood].label.toLowerCase()} stripe was added to your month`);
  renderMonth();
}
setInterval(() => {
  const { t, d } = times();
  $("tCur").textContent = fmt(t); $("tDur").textContent = fmt(d);
  $("fill").style.width = d ? `${Math.min(100, t / d * 100)}%` : "0";
  if (playing && current && !current.counted){
    current.heard += .5;
    if (current.heard >= LISTEN_SECONDS) logListen();
  }
}, 500);

/* ---------- deck keys ---------- */
const press = (id, fn) => $(id).addEventListener("click", () => { SFX.key(); fn(); });
press("playBtn", toggle);
press("ejectBtn", () => inserted ? eject() : insert());
press("rewBtn", () => step(-1));
press("ffBtn", () => step(1));
document.addEventListener("pointerdown", () => SFX.unlock(), { capture: true });
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){ closePanel(); return; }
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || openPanel) return;
  if (e.code === "Space" && !/BUTTON|A/.test(document.activeElement.tagName)){ e.preventDefault(); inserted ? toggle() : insert(); }
  if (e.key === "e") inserted ? eject() : insert();
});
$("soundBtn").addEventListener("click", () => {
  SFX.setMuted(!SFX.muted);
  $("soundBtn").textContent = SFX.muted ? "Sound off" : "Sound on";
  $("soundBtn").setAttribute("aria-pressed", String(!SFX.muted));
  if (!SFX.muted && playing) SFX.hissOn();
});

/* ---------- panels ---------- */
let openPanel = null, lastFocus = null;
function openP(name){
  closePanel();
  lastFocus = document.activeElement;
  openPanel = $("panel-" + name);
  if (name === "month") renderMonth();
  if (name === "shelves") renderSongs();
  $("scrim").hidden = false; openPanel.hidden = false;
  (openPanel.querySelector("[aria-selected='true'], .x") || openPanel).focus();
}
function closePanel(){
  if (!openPanel) return;
  openPanel.hidden = true; $("scrim").hidden = true; openPanel = null;
  if (lastFocus) lastFocus.focus();
}
document.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => openP(b.dataset.open)));
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closePanel));
$("scrim").addEventListener("click", closePanel);

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
    if (!shelf.loading && !shelf.failed) loadShelf(shelf).then(() => { if (shelfId === shelf.id) renderSongs(); });
    return;
  }
  $("blurb").textContent = shelf.mood ? `${shelf.blurb} Each song adds a ${MOOD[shelf.mood].label.toLowerCase()} stripe.` : shelf.blurb;
  $("songs").innerHTML = shelf.songs.map((s, i) => {
    const on = queue && queue.shelfId === shelf.id && queue.index === i;
    return `<li><button class="song ${on ? "on" : ""}" data-i="${i}"><span class="n">${on && playing ? "▶" : pad(i + 1)}</span>
      <span><b>${esc(s.t)}</b><small>${esc(s.a || "")}</small></span><span class="dot" style="background:${MOOD[songMood(shelf, s)].color}"></span></button></li>`;
  }).join("");
}
$("tabs").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  shelfId = b.dataset.shelf;
  const sh = shelfById(shelfId); if (sh) sh.failed = false;
  renderTabs(); renderSongs();
});
$("songs").addEventListener("click", e => {
  const b = e.target.closest(".song"); if (!b) return;
  const shelf = shelfById(shelfId), i = +b.dataset.i;
  closePanel();
  choose(shelf.songs[i], songMood(shelf, shelf.songs[i]), { shelfId: shelf.id, index: i });
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
  if (i < 0){ data.links.push({ t: "Spotify song", a: "", sp: uri, link: spotifyUrl(uri), mood: byoMood }); i = data.links.length - 1; }
  else data.links[i].mood = byoMood;
  saveData(data);
  $("linkIn").value = "";
  shelfId = "links"; renderTabs(); closePanel();
  choose(data.links[i], byoMood, { shelfId: "links", index: i });
  fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl(uri))}`).then(r => r.ok ? r.json() : null).then(o => {
    if (!o || !o.title) return;
    const l = data.links.find(x => x.sp === uri); if (l){ l.t = o.title; saveData(data); }
    if (current && current.song.sp === uri){ current.song.t = o.title; showNow(); }
  }).catch(() => {});
});
$("fileIn").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  if (audio.dataset.url) URL.revokeObjectURL(audio.dataset.url);
  const url = URL.createObjectURL(f); audio.dataset.url = url;
  closePanel();
  choose({ t: f.name.replace(/\.[^.]+$/, ""), a: "From your device", file: url }, byoMood, null);
});

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
    cal += `<span class="${best ? "has" : ""} ${d === now.getDate() ? "today" : ""}" style="${best ? `background:${MOOD[best[0]].color}` : ""}">${d}</span>`;
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

/* ---------- start ---------- */
document.documentElement.style.setProperty("--mood", DEFAULT_MOOD_LIGHT);
renderTabs(); renderMonth();
place();
requestAnimationFrame(place);
document.fonts && document.fonts.ready.then(place);
loadShelf(SHELVES[0]);   // so the first tape is ready the moment you insert it
