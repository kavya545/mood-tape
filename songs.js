// Mood Tape: moods and music shelves.
// Shelves stream free, ad-free music from Audius (audius.co), an open music platform for independent artists.
// Each shelf is one Audius genre and one mood. Every song you listen to from a shelf adds that mood's color to your tape.
// To change a shelf: edit its genre (must be an Audius genre name) or its mood.

const MOODS = [
  { id: "happy",   label: "Happy",   color: "#FFC23C" },
  { id: "calm",    label: "Calm",    color: "#3CC6A4" },
  { id: "loved",   label: "Loved",   color: "#FF7AA8" },
  { id: "low",     label: "Low",     color: "#6C8BFF" },
  { id: "intense", label: "Intense", color: "#FF6B3D" },
  { id: "dreamy",  label: "Dreamy",  color: "#B49BFF" }
];

const SHELVES = [
  { id: "lofi",      name: "Lo-fi & Chill",   genre: "Lo-Fi",     mood: "calm",    blurb: "Study, sketch, sip chai, repeat." },
  { id: "jazz",      name: "Late Night Jazz", genre: "Jazz",      mood: "calm",    blurb: "Low lights, slow sax, nowhere to be." },
  { id: "vaporwave", name: "90s Vaporwave",   genre: "Vaporwave", mood: "dreamy",  blurb: "Retro mall music from a 1995 that never happened." },
  { id: "soul",      name: "R&B & Soul",      genre: "R&B/Soul",  mood: "loved",   blurb: "Slow songs for soft hearts." },
  { id: "funk",      name: "Funk & Groove",   genre: "Funk",      mood: "happy",   blurb: "Shoulders up, volume up." },
  { id: "acoustic",  name: "Acoustic Blues",  genre: "Acoustic",  mood: "low",     blurb: "For the days that need a quiet corner." },
  { id: "rock",      name: "Loud & Rock",     genre: "Rock",      mood: "intense", blurb: "Deadline energy. Headbang responsibly." }
];
