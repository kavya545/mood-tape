# Mood Tape

A music listening site where every song you play adds a colored mood stripe to your monthly cassette.
Made by Kavya Srivastava.

## What's in the folder
| File | What it does |
|---|---|
| `index.html` + `win98.css` + `ui98.js` | **Main site:** a Windows 98 desktop with the MoodAmp player (Winamp style). One screen, no scrolling |
| `poster.html` + `poster.css` | The earlier grainy blue poster version (linked from the Start menu) |
| `style.css` | Styling for the print studio |
| `songs.js` | **The music library.** Moods, shelves and songs. Edit this to add songs |
| `shared.js` | Saving data and drawing the cassette (used by both pages). Your suggestion-form link goes here |
| `app.js` | How the player works |
| `print.html` + `print.js` | The print studio: cassette label, J-card, receipt and stickers |

## How it works
- Songs play through YouTube's official player (the little TV next to the cassette). YouTube requires that player to stay visible.
- A song counts toward your mood after you listen for **30 seconds**. The mood comes from the shelf (genre) it's on.
- Pasted YouTube links and files from your device use the mood you pick.
- Everything is saved in the visitor's own browser (localStorage). No backend, no login. It stays on that device.

## Add a song
1. Open `songs.js`.
2. Find the shelf and copy a line like this:
   `{ t: "Pehla Nasha", a: "Udit Narayan & Sadhana Sargam", id: "ODu7OyAqK-Q" },`
3. Change the title, the artist and the id. The id is the 11 characters after `watch?v=` in the YouTube link.
4. Some videos can't be played on other websites, because the owner turned that off. If a song gets skipped, find another upload of it (lyric videos and "Audio" uploads often work).

## Collect song suggestions
1. Make a free form at tally.so or Google Forms (fields: song, artist, which shelf).
2. Paste the form link into `suggestUrl` at the top of `shared.js`.
Until then, the "Suggest a song" button opens an email to you.

## Run it on your computer
YouTube won't play if you double-click `index.html`. Run a tiny local server instead:
- With Python: open a terminal in this folder and run `python3 -m http.server 8000`, then visit http://localhost:8000
- Or with Node: `npx serve .`

## Put it online (free)
**Easiest: Netlify Drop**
1. Go to https://app.netlify.com/drop
2. Drag the whole `mood-tape` folder onto the page.
3. You get a link like `https://something.netlify.app`. Rename it in Site settings to `moodtape` or similar.

**Or Vercel / GitHub Pages:** push this folder to a GitHub repository and connect it. No build step needed.

## Printing
Open the print studio (Print in the top bar), pick the month and your name, then press Print.
For the J-card to fit a real cassette case, print at 100% scale (turn off "fit to page").
