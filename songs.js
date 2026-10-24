// Mood Tape: moods and music shelves.
// Each shelf has one mood. Every song you listen to from a shelf adds that mood's color to your monthly cassette.
// To add a song: copy a line, change t (title), a (artist) and id (the 11 letters after "watch?v=" in a YouTube link).

const MOODS = [
  { id: "happy",   label: "Happy",   color: "#FFC23C" },
  { id: "calm",    label: "Calm",    color: "#3CC6A4" },
  { id: "loved",   label: "Loved",   color: "#FF7AA8" },
  { id: "low",     label: "Low",     color: "#6C8BFF" },
  { id: "intense", label: "Intense", color: "#FF6B3D" },
  { id: "dreamy",  label: "Dreamy",  color: "#B49BFF" }
];

const SHELVES = [
  { id: "bollywood90s", name: "90s Bollywood", mood: "loved", blurb: "Udit, Alka, Kumar Sanu. Need we say more.",
    songs: [
      { t: "Pehla Nasha", a: "Udit Narayan & Sadhana Sargam", id: "ODu7OyAqK-Q" },
      { t: "Tujhe Dekha To", a: "Lata Mangeshkar & Kumar Sanu", id: "cNV5hLSa9H8" },
      { t: "Ek Ladki Ko Dekha", a: "Kumar Sanu", id: "fTauOK8J-U8" },
      { t: "Dil To Pagal Hai", a: "Lata Mangeshkar & Udit Narayan", id: "lZ2PhyBF3GQ" },
      { t: "Kuch Kuch Hota Hai", a: "Udit Narayan & Alka Yagnik", id: "bKZTnnFU9HA" },
      { t: "Jaadu Teri Nazar", a: "Udit Narayan", id: "n_oP9Onj0r0" },
      { t: "Mere Khwabon Mein", a: "Lata Mangeshkar", id: "s1LozokQjIg" },
      { t: "Dekha Hai Pehli Baar", a: "Alka Yagnik & S. P. Balasubrahmanyam", id: "bBjVLCAAM1A" },
      { t: "Raja Ko Rani Se", a: "Udit Narayan & Alka Yagnik", id: "3C4sUKbEKrw" },
      { t: "Dil Kehta Hai", a: "Kumar Sanu & Alka Yagnik", id: "PqiddY3o3aY" }
    ] },
  { id: "jazz", name: "Late Night Jazz", mood: "calm", blurb: "Low lights, slow sax, nowhere to be.",
    songs: [
      { t: "Take Five", a: "The Dave Brubeck Quartet", id: "-DHuW1h1wHw" },
      { t: "So What", a: "Miles Davis", id: "ylXk1LBvIqU" },
      { t: "Fly Me to the Moon", a: "Frank Sinatra", id: "JYuyWrkwpok" },
      { t: "Feeling Good", a: "Nina Simone", id: "oHRNrgDIJfo" },
      { t: "What a Wonderful World", a: "Louis Armstrong", id: "rBrd_3VMC3c" },
      { t: "My Favorite Things", a: "John Coltrane", id: "qWG2dsXV5HI" },
      { t: "Autumn Leaves", a: "Cannonball Adderley", id: "u37RF5xKNq8" },
      { t: "Summertime", a: "Ella Fitzgerald & Louis Armstrong", id: "2HJCN3upMHE" },
      { t: "Moanin'", a: "Art Blakey & the Jazz Messengers", id: "Cv9NSR-2DwM" },
      { t: "Blue in Green", a: "Miles Davis", id: "TLDflhhdPCg" }
    ] },
  { id: "lofi", name: "Lo-fi & Chill", mood: "calm", blurb: "Study, sketch, sip chai, repeat.",
    songs: [
      { t: "lofi hip hop mix: beats to relax/study to", a: "Lofi Girl", id: "CFGLoQIhmow" },
      { t: "Snowman", a: "WYS", id: "1P5BSm_oFJg" },
      { t: "Coffee", a: "beabadoobee", id: "C6CeA6vRtW4" },
      { t: "affection.", a: "jinsang", id: "6jGPypPNEg4" },
      { t: "Vibe With Me", a: "Joakim Karud", id: "-7YDBIGCXsY" },
      { t: "Sunday Sleep", a: "Tomppabeats", id: "hCG_Ef6weQk" },
      { t: "Before Paris", a: "Tom Misch", id: "Iu9MVgMYrEY" }
    ] },
  { id: "english90s", name: "90s Pop Party", mood: "happy", blurb: "Walkman on, volume up.",
    songs: [
      { t: "Wannabe", a: "Spice Girls", id: "tTZDHlnTgR0" },
      { t: "I Want It That Way", a: "Backstreet Boys", id: "z6Wq59qrdB0" },
      { t: "Wonderwall", a: "Oasis", id: "PoJh4JNedns" },
      { t: "Dreams", a: "The Cranberries", id: "Yam5uK6e-bQ" },
      { t: "No Scrubs", a: "TLC", id: "FrLequ6dUdM" },
      { t: "Torn", a: "Natalie Imbruglia", id: "VV1XWJN3nJo" },
      { t: "MMMBop", a: "Hanson", id: "NHozn0YXAeE" },
      { t: "Bitter Sweet Symphony", a: "The Verve", id: "1lyu1KKwC74" },
      { t: "...Baby One More Time", a: "Britney Spears", id: "C-u5WLJ9Yk4" }
    ] },
  { id: "soulful", name: "Sad & Soulful", mood: "low", blurb: "For the days that need a good cry.",
    songs: [
      { t: "Agar Tum Saath Ho", a: "Alka Yagnik & Arijit Singh", id: "sK7riqg2mr4" },
      { t: "Tum Hi Ho", a: "Arijit Singh", id: "Umqb9KENgmk" },
      { t: "Kabira", a: "Tochi Raina & Rekha Bhardwaj", id: "jHNNMj5bNQw" },
      { t: "Channa Mereya", a: "Arijit Singh", id: "qZX_AylI9VQ" },
      { t: "Hoshwalon Ko Khabar Kya", a: "Jagjit Singh", id: "ag3ENMEV89o" },
      { t: "Chupke Chupke Raat Din", a: "Ghulam Ali", id: "MWjaK_nW72E" },
      { t: "Someone Like You", a: "Adele", id: "22c3_LoIfZQ" },
      { t: "Fix You", a: "Coldplay", id: "k4V3Mo61fJM" },
      { t: "Glimpse of Us", a: "Joji", id: "FvOpPeKSf_4" },
      { t: "Iktara", a: "Kavita Seth", id: "ZlOZktsODpA" }
    ] },
  { id: "rock", name: "Loud & Rock", mood: "intense", blurb: "Deadline energy. Headbang responsibly.",
    songs: [
      { t: "Smells Like Teen Spirit", a: "Nirvana", id: "hTWKbfoikeg" },
      { t: "Numb", a: "Linkin Park", id: "KIfYtDl4B2g" },
      { t: "Mr. Brightside", a: "The Killers", id: "pvIJyRkS9y0" },
      { t: "Bohemian Rhapsody", a: "Queen", id: "fJ9rUzIMcZQ" },
      { t: "Seven Nation Army", a: "The White Stripes", id: "CBEJo18auXE" },
      { t: "Sweet Child O' Mine", a: "Guns N' Roses", id: "D2gWc5Sw75w" },
      { t: "Zinda", a: "Siddharth Mahadevan", id: "Ax0G_P2dSBw" },
      { t: "Sultans of Swing", a: "Dire Straits", id: "89Qg_gYqkys" }
    ] },
  { id: "indie", name: "Indie Daydreams", mood: "dreamy", blurb: "Window seat, rain outside.",
    songs: [
      { t: "Kho Gaye Hum Kahan", a: "Jasleen Royal & Prateek Kuhad", id: "ymhHUEPEKwQ" },
      { t: "cold/mess", a: "Prateek Kuhad", id: "Il7Nv270zNk" },
      { t: "Choo Lo", a: "The Local Train", id: "sFMRqxCexDk" },
      { t: "Aaoge Tum Kabhi", a: "The Local Train", id: "hvKaPTmQBA8" },
      { t: "Baarishein", a: "Anuv Jain", id: "PJWemSzExXs" },
      { t: "Husn", a: "Anuv Jain", id: "0IIJxkDtkHY" },
      { t: "Tu Aake Dekhle", a: "King", id: "A66TYFdz8YA" },
      { t: "blue", a: "yung kai", id: "IpFX2vq8HKw" },
      { t: "Pink + White", a: "Frank Ocean", id: "uzS3WG6__G4" },
      { t: "Riptide", a: "Vance Joy", id: "uJ_1HMAGb4k" }
    ] }
];
