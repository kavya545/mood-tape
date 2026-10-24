// Print studio: turns a month of listening into a cassette label, a J-card, a receipt and stickers.
const $ = id => document.getElementById(id);
const data = loadData();
let labelColor = "stripes";

// Months that have listens, plus the current month.
const months = [...new Set([monthKey(new Date()), ...data.listens.map(l => monthKey(new Date(l.ts)))])].sort().reverse();
const nameOf = mk => { const [y, m] = mk.split("-").map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };
$("pMonth").innerHTML = months.map(mk => `<option value="${mk}">${nameOf(mk)}</option>`).join("");
$("pName").value = data.name || "";

function colorChips(){
  const opts = [{ id: "stripes", label: "Mood stripes", color: "linear-gradient(90deg," + MOODS.map(m => m.color).join(",") + ")" }, ...MOODS];
  $("pColor").innerHTML = opts.map(o => `<button class="chip" style="--c:${o.id === "stripes" ? "#18191E" : o.color}" data-c="${o.id}" aria-pressed="${o.id === labelColor}"><i style="background:${o.color}"></i>${o.label}</button>`).join("");
}
$("pColor").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b){ labelColor = b.dataset.c; colorChips(); render(); } });

function topSongs(ls, n){
  const map = new Map();
  ls.forEach(l => { const k = l.t + "|" + l.a; const v = map.get(k) || { t: l.t, a: l.a, mood: l.mood, n: 0 }; v.n++; map.set(k, v); });
  return [...map.values()].sort((a, b) => b.n - a.n).slice(0, n);
}

function render(){
  const mk = $("pMonth").value, ls = listensIn(data, mk), counts = moodCounts(ls);
  const name = $("pName").value.trim();
  const [y, m] = mk.split("-").map(Number);
  const month = MONTH_NAMES[m - 1];
  const title = name ? `${name}'s ${month}` : `${month} '${String(y).slice(2)}`;
  const stripes = stripeColors(ls, 60);
  const top = counts[0];
  const bg = labelColor === "stripes" ? (top ? top.color : "#E9E6DD") : MOOD[labelColor].color;
  const show = id => document.querySelector(`[data-sheet="${id}"]`).checked;
  const legend = counts.map(c => `<span><i style="background:${c.color}"></i>${c.label} ${c.n}</span>`).join("");
  const songs = topSongs(ls, 12);
  let html = "";

  $("pHint").textContent = ls.length ? `${ls.length} songs in ${month}.` : `No songs in ${month} yet. Listen to a few on the player first, or print an empty tape to fill in by hand.`;

  if (show("cas")) html += `<section class="sheet"><h4>Cassette label · cut along the edge</h4><div class="cas-wrap">
    ${cassetteSVG({ title, sub: top ? `mostly ${top.label.toLowerCase()} · ${ls.length} songs` : "a blank tape", color: bg, stripes, uid: "p", rl: 18, rr: 18 })}
    <div class="cas-legend">${legend}</div></div></section>`;

  if (show("jcard")) html += `<section class="sheet"><h4>J-card · fold on the dashed lines, slide into a cassette case</h4>
    <div class="jcard cut">
      <div class="j-front">
        <div class="stripes-p">${(stripes.length ? stripes : ["#E9E6DD"]).map(c => `<i style="background:${c}"></i>`).join("")}</div>
        <div class="t">${esc(title)}</div>
        <div class="s">${top ? `mostly ${esc(top.label.toLowerCase())} · ${ls.length} songs` : "side A"}</div>
        <ol>${songs.map(s => `<li>${esc(s.t)}</li>`).join("") || "<li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li>"}</ol>
      </div>
      <div class="j-spine" style="background:${bg}"><span>${esc(title)} · MOOD TAPE</span></div>
      <div class="j-flap">${(counts.length ? counts : [{ color: "#E9E6DD", n: 1 }]).map(c => `<i style="background:${c.color};flex-grow:${c.n}"></i>`).join("")}</div>
    </div><p class="fold-note">Real cassette size: 101.6 mm tall. Print at 100% (no "fit to page").</p></section>`;

  if (show("receipt")){
    const total = ls.length;
    html += `<section class="sheet"><h4>Mood receipt</h4><div class="receipt cut">
      <div class="c big">Mood Tape</div><div class="c">${esc(name ? name.toUpperCase() : "YOUR")} · ${month.toUpperCase()} ${y}</div><hr>
      ${counts.map(c => `<div class="r"><span>${c.label.toUpperCase()}</span><span>x${c.n}</span></div>`).join("") || `<div class="r"><span>NO MOODS YET</span><span>x0</span></div>`}
      <hr><div>MOST PLAYED</div>
      ${songs.slice(0, 5).map(s => `<div class="r"><span>${esc(s.t)}</span><span>${s.n}</span></div>`).join("") || "<div>-</div>"}
      <hr><div class="r"><b>TOTAL SONGS</b><b>${total}</b></div>
      <div class="r"><span>TODAY'S CHANGE</span><span>1 good day</span></div><hr>
      <div class="c">THANK YOU FOR FEELING<br>PLEASE COME AGAIN</div><div class="barcode"></div></div></section>`;
  }

  if (show("stickers")) html += `<section class="sheet"><h4>Mood stickers · print on sticker paper and cut out</h4><div class="stickers">
    ${MOODS.map(mo => { const c = counts.find(x => x.id === mo.id); return `<div class="sticker" style="background:${mo.color}"><b>${mo.label}</b><small>${c ? `x${c.n} in ${month.slice(0, 3)}` : month.slice(0, 3)}</small></div>`; }).join("")}
    ${top ? `<div class="sticker" style="background:#18191E;color:#fff"><b>Mostly</b><small>${top.label.toLowerCase()}</small></div>` : ""}
    <div class="sticker" style="background:#F7F5EE"><b>${esc(name || "Mood")}</b><small>MOOD TAPE</small></div></div></section>`;

  $("sheets").innerHTML = html || `<p class="hint">Tick at least one thing to print.</p>`;
}

$("pMonth").onchange = render;
$("pName").oninput = () => { data.name = $("pName").value.trim(); saveData(data); render(); };
document.querySelectorAll("[data-sheet]").forEach(c => c.onchange = render);
$("printBtn").onclick = () => window.print();
colorChips(); render();
