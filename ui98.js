// Windows 98 extras for Mood Tape: visualizer bars, marquee, start menu, clock and tray mood.
(function(){
  const $ = id => document.getElementById(id);

  // spectrum visualizer: each bar gets its own height and speed
  $("viz").innerHTML = Array.from({ length: 18 }, () =>
    `<i style="--h:${30 + Math.round(Math.random() * 70)}%;animation-duration:${(0.35 + Math.random() * 0.6).toFixed(2)}s"></i>`).join("");

  // marquee: copy the title so it loops without a gap
  const title = $("nowTitle"), dup = document.querySelector(".marquee .dup");
  const syncMarquee = () => { dup.textContent = title.textContent; };
  new MutationObserver(syncMarquee).observe(title, { childList: true, characterData: true, subtree: true });
  syncMarquee();

  // play state letter on the LCD
  const state = $("lcdState");
  new MutationObserver(() => { state.textContent = document.body.classList.contains("is-playing") ? "▶" : "❚❚"; })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });

  // start menu
  const btn = $("startBtn"), menu = $("startMenu");
  const setMenu = open => { menu.hidden = !open; btn.setAttribute("aria-expanded", open); };
  btn.addEventListener("click", e => { e.stopPropagation(); setMenu(menu.hidden); });
  menu.addEventListener("click", () => setMenu(false));
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

  // desktop "Suggest a Song" icon uses the same action as the start menu item
  document.querySelectorAll("[data-suggest]").forEach(el => el.addEventListener("click", () => $("suggestBtn").click()));

  // clock in the tray
  const clock = () => { $("clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
  clock(); setInterval(clock, 15000);
})();
