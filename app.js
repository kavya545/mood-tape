// Mood Tape player: plays shelf songs through YouTube, pasted links, or files from your device,
// and logs the mood of every song you actually listen to (30 seconds or more).

const $ = id => document.getElementById(id);
const data = loadData();
const LISTEN_SECONDS = 30;

let shelfId = SHELVES[0].id;     // shelf shown in the tabs
let queue = null;                // { shelfId, index } for prev/next
let current = null;              // { src: "yt" | "file", song: {t, a, id?, mood}, counted, heard }
let player = null, playerReady = false, pendingId = null;
let playing = false;
let byoMood = "happy";
let errorsInARow = 0;

if (location.protocol === "file:") $("fileWarn").hidden = false;

/* ---------- helpers ---------- */
const fmt = s => !isFinite(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
let toastT;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
const shelfById = id => SHELVES.find(s => s.id === id) || (id === "links" ? linksShelf() : null);
function linksShelf(){ return { id: "links", name: "Your links", mood: null, blurb: "Songs you pasted from YouTube.", songs: data.links }; }
function songMood(shelf, song){ return song.mood || shelf.mood; }
function parseYouTubeId(url){
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1, 12);
    if (u.searchParams.get("v")) return u.searchParams.get("v").slice(0, 11);
    const m = u.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    return m ? m[2] : null;
  } catch (e) { return null; }
}

/* ---------- cassette ---------- */
function drawCassette(){
  const mk = monthKey(new Date());
  const mood = current ? MOOD[current.song.mood] : null;
  $("cassette").innerHTML = cassetteSVG({
    title: current ? current.song.t : "Mood Tape",
    sub: current ? (current.song.a || "") : "press play to start this month's tape",
    color: mood ? mood.color : "#E9E6DD",
    stripes: stripeColors(listensIn(data, mk)),
    uid: "main", cls: playing ? "playing" : ""
  });
  updateReels();
}
function updateReels(){
  const { t, d } = times();
  const p = d ? Math.min(1, t / d) : 0;
  const svg = $("cassette").querySelector("svg");
  if (!svg) return;
  svg.querySelector(".tapeL").setAttribute("r", (10 + 16 * (1 - p)).toFixed(1));
  svg.querySelector(".tapeR").setAttribute("r", (10 + 16 * p).toFixed(1));
}
function setPlaying(on){
  playing = on;
  const svg = $("cassette").querySelector("svg");
  if (svg) svg.classList.toggle("playing", on);
  $("playIcon").innerHTML = on ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
  $("playBtn").setAttribute("aria-label", on ? "Pause" : "Play");
}

/* ---------- now playing ---------- */
function showNow(){
  if (!current) return;
  const m = MOOD[current.song.mood];
  $("nowMood").innerHTML = `<i style="background:${m.color}"></i>${m.label}`;
  $("nowTitle").textContent = current.song.t;
  $("nowArtist").textContent = current.song.a || "";
  document.title = `${current.song.t} · Mood Tape`;
  drawCassette();
  renderSongs();
}

/* ---------- playing things ---------- */
function stopAll(){
  try { if (player && playerReady) player.stopVideo(); } catch (e) {}
  const a = $("audio"); a.pause();
}
function playSong(shelf, index){
  const song = shelf.songs[index];
  if (!song) return;
  queue = { shelfId: shelf.id, index };
  current = { src: "yt", song: { ...song, mood: songMood(shelf, song) }, counted: false, heard: 0 };
  $("audio").pause();
  showNow();
  if (playerReady) player.loadVideoById(song.id);
  else { pendingId = song.id; toast("Loading the player…"); }
}
function playFile(file){
  stopAll();
  const a = $("audio");
  if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
  const url = URL.createObjectURL(file);
  a.dataset.url = url; a.src = url;
  queue = null;
  current = { src: "file", song: { t: file.name.replace(/\.[^.]+$/, ""), a: "From your device", mood: byoMood }, counted: false, heard: 0 };
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
  if (!current){ playSong(shelfById(shelfId), 0); return; }
  if (current.src === "file"){ const a = $("audio"); a.paused ? a.play() : a.pause(); return; }
  if (!playerReady) return;
  playing ? player.pauseVideo() : player.playVideo();
}
function times(){
  if (!current) return { t: 0, d: 0 };
  if (current.src === "file"){ const a = $("audio"); return { t: a.currentTime || 0, d: a.duration || 0 }; }
  if (!playerReady) return { t: 0, d: 0 };
  try { return { t: player.getCurrentTime() || 0, d: player.getDuration() || 0 }; } catch (e) { return { t: 0, d: 0 }; }
}
function seekTo(frac){
  const { d } = times(); if (!d) return;
  if (current.src === "file") $("audio").currentTime = frac * d;
  else player.seekTo(frac * d, true);
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

// tick: progress bar, reels, and the 30-second listen counter
setInterval(() => {
  const { t, d } = times();
  $("tCur").textContent = fmt(t); $("tDur").textContent = fmt(d);
  $("fill").style.width = d ? `${Math.min(100, t / d * 100)}%` : "0";
  $("seek").setAttribute("aria-valuenow", d ? Math.round(t / d * 100) : 0);
  updateReels();
  if (playing && current && !current.counted){
    current.heard += 0.5;
    if (current.heard >= LISTEN_SECONDS) logListen();
  }
}, 500);

/* ---------- YouTube ---------- */
window.onYouTubeIframeAPIReady = function(){
  player = new YT.Player("yt", {
    width: 200, height: 200,
    playerVars: { playsinline: 1, rel: 0 },
    events: {
      onReady: () => { playerReady = true; if (pendingId){ player.loadVideoById(pendingId); pendingId = null; } },
      onStateChange: e => {
        if (current && current.src !== "yt") return;
        if (e.data === YT.PlayerState.PLAYING){
          $("screenOff").hidden = true; setPlaying(true); errorsInARow = 0;
          // pasted links start without a title, so read it from the video
          if (current && current.song.unknown){
            const v = player.getVideoData();
            if (v && v.title){
              current.song.t = v.title; current.song.a = v.author || ""; delete current.song.unknown;
              const saved = data.links.find(l => l.id === current.song.id);
              if (saved){ saved.t = current.song.t; saved.a = current.song.a; delete saved.unknown; saveData(data); }
              showNow();
            }
          }
        } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.CUED){ setPlaying(false); }
        else if (e.data === YT.PlayerState.ENDED){ setPlaying(false); if (current && current.heard >= 10) logListen(); step(1); }
      },
      onError: () => {
        setPlaying(false);
        errorsInARow++;
        const url = current ? `https://www.youtube.com/watch?v=${current.song.id}` : "https://www.youtube.com";
        $("nowArtist").innerHTML = `${esc(current ? current.song.a || "" : "")} · <a href="${url}" target="_blank" rel="noopener">Open on YouTube ↗</a>`;
        if (errorsInARow >= 3){ toast("YouTube is blocking playback here. Try another shelf, or open the song on YouTube."); errorsInARow = 0; return; }
        toast("This video can't play outside YouTube. Skipping it.");
        setTimeout(() => step(1), 1500);
      }
    }
  });
};

/* ---------- own files ---------- */
const audio = $("audio");
audio.addEventListener("play", () => { if (current && current.src === "file") setPlaying(true); });
audio.addEventListener("pause", () => { if (current && current.src === "file") setPlaying(false); });
audio.addEventListener("ended", () => { setPlaying(false); if (current && current.heard >= 10) logListen(); });

/* ---------- UI: shelves ---------- */
function allShelves(){ return data.links.length ? [...SHELVES, linksShelf()] : SHELVES; }
function renderTabs(){
  $("tabs").innerHTML = allShelves().map(s => {
    const c = s.mood ? MOOD[s.mood].color : "var(--muted)";
    return `<button class="tab" role="tab" aria-selected="${s.id === shelfId}" data-shelf="${s.id}"><i style="background:${c}"></i>${esc(s.name)}</button>`;
  }).join("");
}
function renderSongs(){
  const shelf = shelfById(shelfId);
  if (!shelf){ shelfId = SHELVES[0].id; return renderSongs(); }
  $("blurb").textContent = shelf.mood ? `${shelf.blurb} Every song here adds a ${MOOD[shelf.mood].label.toLowerCase()} stripe.` : shelf.blurb;
  $("songs").innerHTML = shelf.songs.map((s, i) => {
    const on = queue && queue.shelfId === shelf.id && queue.index === i;
    const c = MOOD[songMood(shelf, s)].color;
    return `<li><button class="song ${on ? "on" : ""}" data-i="${i}"><span class="n">${on && playing ? "♪" : pad(i + 1)}</span>
      <span><b>${esc(s.t)}</b><small>${esc(s.a || "YouTube link")}</small></span><span class="dot" style="background:${c}"></span></button></li>`;
  }).join("");
}
$("tabs").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  shelfId = b.dataset.shelf; renderTabs(); renderSongs();
});
$("songs").addEventListener("click", e => {
  const b = e.target.closest(".song"); if (!b) return;
  playSong(shelfById(shelfId), +b.dataset.i);
});

/* ---------- UI: bring your own ---------- */
function moodChips(el, selected, attr){
  el.innerHTML = MOODS.map(m => `<button class="chip" style="--c:${m.color}" data-${attr}="${m.id}" aria-pressed="${m.id === selected}"><i style="background:${m.color}"></i>${m.label}</button>`).join("");
}
moodChips($("byoMoods"), byoMood, "mood");
$("byoMoods").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  byoMood = b.dataset.mood; moodChips($("byoMoods"), byoMood, "mood");
});
$("linkForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = parseYouTubeId($("linkIn").value);
  if (!id || id.length !== 11){ toast("That doesn't look like a YouTube link. Try copying it again."); return; }
  let i = data.links.findIndex(l => l.id === id);
  if (i < 0){ data.links.push({ t: "YouTube link", a: "", id, mood: byoMood, unknown: true }); i = data.links.length - 1; }
  else data.links[i].mood = byoMood;
  saveData(data);
  $("linkIn").value = "";
  shelfId = "links"; renderTabs();
  playSong(linksShelf(), i);
});
$("fileIn").addEventListener("change", e => { const f = e.target.files[0]; if (f) playFile(f); e.target.value = ""; });

/* ---------- UI: my month ---------- */
function renderMonth(){
  const now = new Date(), mk = monthKey(now);
  const ls = listensIn(data, mk), cs = checkinsIn(data, mk);
  $("monthTitle").textContent = `${MONTH_NAMES[now.getMonth()]} so far`;
  const stripes = stripeColors(ls, 120);
  $("stripes").innerHTML = stripes.length ? stripes.map(c => `<i style="background:${c}"></i>`).join("") : `<span class="empty">Your stripes appear here after you listen for 30 seconds.</span>`;
  const counts = moodCounts(ls);
  if (counts.length){
    const top = counts[0];
    $("insight").textContent = `Mostly ${top.label.toLowerCase()} this month: ${top.n} of ${ls.length} songs.`;
  } else $("insight").textContent = "No songs on this month's tape yet.";
  $("legend").innerHTML = counts.map(m => `<span><i style="background:${m.color}"></i>${m.label} ${m.n}</span>`).join("");

  // days: the most common mood of each day (a check-in counts as 3 songs)
  const days = daysInMonth(now), first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  let cal = "<span style='border:0'></span>".repeat(first);
  for (let d = 1; d <= days; d++){
    const tally = {};
    ls.forEach(l => { if (new Date(l.ts).getDate() === d) tally[l.mood] = (tally[l.mood] || 0) + 1; });
    cs.forEach(c => { if (new Date(c.ts).getDate() === d) tally[c.mood] = (tally[c.mood] || 0) + 3; });
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const col = best ? MOOD[best[0]].color : "";
    cal += `<span class="${best ? "has" : ""} ${d === now.getDate() ? "today" : ""}" style="${best ? `background:${col}` : ""}" title="${best ? MOOD[best[0]].label : ""}">${d}</span>`;
  }
  $("cal").innerHTML = cal;

  const recent = [...data.listens].reverse().slice(0, 8);
  $("recent").innerHTML = recent.length ? recent.map(l => {
    const d = new Date(l.ts);
    return `<li><i style="background:${MOOD[l.mood].color}"></i><span>${esc(l.t)}${l.a ? ` · <span style="color:var(--muted)">${esc(l.a)}</span>` : ""}</span><small>${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}</small></li>`;
  }).join("") : `<li class="none">Nothing yet. Play anything for 30 seconds.</li>`;
}
const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

moodChips($("checkin"), null, "check");
$("checkin").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  data.checkins.push({ ts: Date.now(), mood: b.dataset.check });
  saveData(data); renderMonth();
  toast(`Noted: feeling ${MOOD[b.dataset.check].label.toLowerCase()} today`);
});

/* ---------- controls ---------- */
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
  if (e.code === "Space" && !/INPUT|BUTTON|TEXTAREA/.test(document.activeElement.tagName)){ e.preventDefault(); toggle(); }
});

/* ---------- suggest a song ---------- */
$("suggestBtn").onclick = () => {
  if (CONFIG.suggestUrl){ window.open(CONFIG.suggestUrl, "_blank", "noopener"); return; }
  location.href = `mailto:${CONFIG.suggestEmail}?subject=${encodeURIComponent("Song suggestion for Mood Tape")}&body=${encodeURIComponent("Song:\nArtist:\nWhich shelf should it go on?\n")}`;
};

/* ---------- start ---------- */
renderTabs(); renderSongs(); drawCassette(); renderMonth();
