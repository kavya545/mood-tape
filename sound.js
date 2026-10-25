// Mood Tape sound design. Every sound is synthesized live with the Web Audio API, so there are no audio files to license.
const SFX = (() => {
  let ctx = null, master = null, muted = false;
  let hiss = null, media = null, analyser = null, freq = null;

  function ac(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  let noiseBuffer = null;
  function noise(){
    if (noiseBuffer) return noiseBuffer;
    const c = ac(), b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuffer = b);
  }
  // a short filtered noise hit (clicks, thumps, latches)
  function burst({ dur = .05, f = 2000, q = 1, type = "bandpass", gain = .5, at = 0 }){
    if (muted) return;
    const c = ac(), t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = noise();
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(fl).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + .02);
  }
  // a pitched blip that slides from f1 to f2 (body of a thump, a spring)
  function tone({ f1 = 90, f2 = 45, dur = .15, gain = .6, type = "sine", at = 0 }){
    if (muted) return;
    const c = ac(), t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }

  return {
    unlock: ac,
    // tape seated in the deck: plastic click, heavy thump, then the door latch
    clunk(){ burst({ dur: .018, f: 3200, gain: .45 }); tone({ f1: 110, f2: 42, dur: .2, gain: .9 }); burst({ dur: .09, f: 700, type: "lowpass", gain: .7 }); burst({ dur: .02, f: 2400, q: 3, gain: .35, at: .09 }); tone({ f1: 180, f2: 90, dur: .05, gain: .25, at: .09 }); },
    // eject: latch release, spring, tape pops up
    eject(){ burst({ dur: .02, f: 2600, q: 2, gain: .4 }); tone({ f1: 320, f2: 1100, dur: .09, gain: .12, type: "triangle", at: .02 }); burst({ dur: .07, f: 900, type: "lowpass", gain: .45, at: .06 }); },
    // a chunky piano key on the deck
    key(){ burst({ dur: .014, f: 4200, q: 2, gain: .3 }); tone({ f1: 160, f2: 70, dur: .045, gain: .3 }); },
    // tape winding fast (rewind / fast forward)
    whirr(dur = .7){
      if (muted) return;
      const c = ac(), t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(); src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 6;
      fl.frequency.setValueAtTime(700, t); fl.frequency.exponentialRampToValueAtTime(2600, t + dur * .7);
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(260, t + dur);
      const og = c.createGain(); og.gain.value = .05;
      const g = c.createGain(); g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.35, t + .08); g.gain.setValueAtTime(.35, t + dur - .1); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      src.connect(fl).connect(g); o.connect(og).connect(g); g.connect(master);
      src.start(t); o.start(t); src.stop(t + dur + .05); o.stop(t + dur + .05);
    },
    // soft tape hiss under the music
    hissOn(){
      if (muted || hiss) return;
      const c = ac(), src = c.createBufferSource(); src.buffer = noise(); src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = "highpass"; fl.frequency.value = 3500;
      const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(.018, c.currentTime + .6);
      src.connect(fl).connect(g).connect(master); src.start();
      hiss = { src, g };
    },
    hissOff(){
      if (!hiss) return;
      const c = ac(), h = hiss; hiss = null;
      h.g.gain.linearRampToValueAtTime(0, c.currentTime + .3); h.src.stop(c.currentTime + .35);
    },
    // route the <audio> element through an analyser so the deck can react to the real music
    attach(audioEl){
      if (media) return analyser;
      const c = ac();
      media = c.createMediaElementSource(audioEl);
      analyser = c.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .75;
      freq = new Uint8Array(analyser.frequencyBinCount);
      media.connect(analyser); analyser.connect(c.destination);
      return analyser;
    },
    // 0..1 loudness of the bass and of the whole song right now
    levels(){
      if (!analyser) return { bass: 0, all: 0 };
      analyser.getByteFrequencyData(freq);
      let b = 0, a = 0;
      for (let i = 0; i < 8; i++) b += freq[i];
      for (let i = 0; i < 96; i++) a += freq[i];
      return { bass: b / (8 * 255), all: a / (96 * 255) };
    },
    get muted(){ return muted; },
    setMuted(m){ muted = m; if (m) this.hissOff(); }
  };
})();
