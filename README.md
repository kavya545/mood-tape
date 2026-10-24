# Mood Tape

A music listening site where every song you play adds a colored mood stripe to your monthly cassette.
Made by Kavya Srivastava.

## What's in the folder
| File | What it does |
|---|---|
| `index.html` | The landing page and player: one screen, no scrolling. Shelves, Your music and My month open as glass panels |
| `poster.css` | Styling for the landing page (the grainy blue poster look) |
| `style.css` | Styling for the print studio |
| `songs.js` | **The music library.** Moods, shelves and songs. Edit this to add songs |
| `shared.js` | Saving data and drawing the cassette (used by both pages). Your suggestion-form link goes here |
| `app.js` | How the player works |
| `print.html` + `print.js` | The print studio: cassette label, J-card, receipt and stickers |

## How it works
- Shelf songs stream free and ad-free from **Audius** (audius.co), an open platform for independent artists. Each shelf loads that genre's top tracks.
- Pasted YouTube links play in a small video window (YouTube requires it to stay visible). These can show YouTube ads.
- A song counts toward your mood after you listen for **30 seconds**. The mood comes from the shelf (genre) it's on.
- Pasted YouTube links and files from your device use the mood you pick.
- Everything is saved in the visitor's own browser (localStorage). No backend, no login. It stays on that device.

## Change the shelves
Open `songs.js`. Each shelf has a `genre` (an Audius genre such as Lo-Fi, Jazz, Vaporwave, Funk, Rock, Ambient, Pop, R&B/Soul) and a `mood`.
Change them, or copy a line to add a new shelf.

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
