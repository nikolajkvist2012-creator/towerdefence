// Lyd og musik – alt laves med Web Audio API direkte i koden (ingen lydfiler).
//
// Musikken er små retro-melodier (8-bit), der spilles i løkke: én til menuen og én pr. bane.
// Hver melodi er 4 takter à 8 ottendedele = 32 trin. Tegn i mønstrene:
//   'C5'  = spil tonen C i 5. oktav ('#' = højere halvtone, 'b' = lavere)
//   '-'   = hold den forrige tone et trin mere
//   '.'   = pause
//   '|'   = taktstreg (ignoreres – kun for at gøre det læsbart)
// Trommer: 'x' = slag, '.' = intet (8 tegn pr. takt, gentages for alle 4 takter).

const TRACKS = {
  menu: {
    bpm: 120, lead: 'square', bass: 'triangle',
    melody: 'C5 . E5 . G5 . E5 . | F5 . A5 . G5 - - . | E5 . G5 . C6 . B5 . | D5 . G4 . C5 - - .',
    bassline: 'C3 . C3 . G2 . G2 . | F2 . F2 . C3 . C3 . | A2 . A2 . E2 . E2 . | G2 . G2 . C3 . C3 .',
    kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x',
  },
  grass: {
    bpm: 132, lead: 'square', bass: 'triangle',
    melody: 'G4 . B4 . D5 . B4 . | C5 . E5 . D5 - B4 . | A4 . C5 . B4 . G4 . | A4 . F#4 . G4 - - .',
    bassline: 'G2 . G2 . D2 . D2 . | C2 . C2 . G2 . G2 . | D2 . D2 . G2 . E2 . | D2 . D2 . G2 . . .',
    kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x',
  },
  lava: {
    // Mørk mol, tung bas
    bpm: 108, lead: 'sawtooth', bass: 'square', leadGain: 0.6,
    melody: 'D4 . . F4 E4 . D4 . | A3 . . C4 D4 - - . | D4 . . F4 G4 . A4 . | Bb4 . A4 . G4 . E4 .',
    bassline: 'D2 D2 . D2 D2 . C2 . | A1 A1 . A1 D2 . . . | D2 D2 . D2 G1 . G1 . | Bb1 . Bb1 . A1 . A1 .',
    kick: 'x..x..x.', snare: '....x...', hat: '..x...x.',
  },
  ice: {
    // Lyse klokke-arpeggioer
    bpm: 96, lead: 'triangle', bass: 'sine', leadGain: 1.3,
    melody: 'E5 G#5 B5 E6 B5 G#5 E5 B4 | A4 C#5 E5 A5 E5 C#5 A4 E4 | B4 D#5 F#5 B5 F#5 D#5 B4 F#4 | E5 G#5 B5 E6 . . . .',
    bassline: 'E2 - - - . . . . | A2 - - - . . . . | B2 - - - . . . . | E2 - - - . . . .',
    kick: 'x.......', snare: '........', hat: '..x...x.',
  },
  water: {
    // Rolig og bølgende
    bpm: 84, lead: 'triangle', bass: 'sine', leadGain: 1.3,
    melody: 'A4 - - C5 - - A4 . | G4 - - . F4 - - . | A4 - - C5 - - D5 . | C5 - - - . . . .',
    bassline: 'F2 - - - C3 - - - | Bb2 - - - F2 - - - | F2 - - - A2 - - - | C3 - - - C2 - - -',
    kick: 'x.......', snare: '........', hat: '....x...',
  },
  desert: {
    // "Mellemøstlig" skala (E F G# A B C D)
    bpm: 116, lead: 'square', bass: 'triangle',
    melody: 'E5 F5 G#5 . F5 E5 . . | E5 F5 G#5 A5 G#5 F5 E5 . | B4 C5 D5 . C5 B4 . . | C5 B4 A4 G#4 F4 . E4 .',
    bassline: 'E2 . E2 . E2 . F2 . | E2 . E2 . E2 . F2 . | A2 . A2 . G#2 . G#2 . | F2 . F2 . E2 . E2 .',
    kick: 'x..x..x.', snare: '....x...', hat: 'x.x.x.x.',
  },
  rocks: {
    // Hurtig og drivende
    bpm: 138, lead: 'square', bass: 'square', bassGain: 0.6,
    melody: 'A4 . C5 . E5 . C5 . | G4 . B4 . D5 . B4 . | F4 . A4 . C5 . E5 . | E5 . D5 . C5 . B4 .',
    bassline: 'A2 A2 A2 A2 A2 A2 A2 A2 | G2 G2 G2 G2 G2 G2 G2 G2 | F2 F2 F2 F2 F2 F2 F2 F2 | E2 E2 E2 E2 E2 E2 E2 E2',
    kick: 'x...x...', snare: '..x...x.', hat: 'xxxxxxxx',
  },
};

const STEPS = 32;          // trin pr. løkke (4 takter à 8 ottendedele)
const MUSIC_VOLUME = 0.11;
const SFX_VOLUME = 0.28;
const BOSS_TEMPO = 1.15;   // musikken er 15 % hurtigere, mens bossen er på banen

// Mindste tid (sekunder) mellem to ens lydeffekter, så 20 tårne ikke larmer i kor
const SFX_GAP = { shot: 0.06, enemyDie: 0.05, lifeLost: 0.15, coin: 0.2 };

class SoundEngine {
  constructor() {
    this.ctx = null;           // AudioContext – laves først efter første klik (browser-regel)
    this.musicOn = load('td-music', true);
    this.sfxOn = load('td-sfx', true);
    this.trackId = null;
    this.intense = false;
    this.timer = null;
    this.lastPlayed = {};
    this.tracks = {};
    for (const [id, t] of Object.entries(TRACKS)) this.tracks[id] = parseTrack(t);

    // Browsere tillader først lyd efter brugerens første klik/tastetryk
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? MUSIC_VOLUME : 0;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = SFX_VOLUME;
      this.sfxGain.connect(this.ctx.destination);
      this.noise = makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn && this.trackId && !this.timer) this.startScheduler();
  }

  // ---------- Musik ----------

  // Skift melodi ('menu' eller et bane-id). Samme melodi igen gør ingenting.
  playMusic(trackId) {
    if (!this.tracks[trackId]) trackId = 'menu';
    if (trackId === this.trackId) return;
    this.trackId = trackId;
    this.intense = false;
    this.stopScheduler();
    if (this.ctx && this.musicOn) this.startScheduler();
  }

  // Bossen er på banen → hurtigere musik og flere trommer
  setIntense(on) {
    this.intense = on;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    save('td-music', this.musicOn);
    if (this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicOn ? MUSIC_VOLUME : 0, this.ctx.currentTime, 0.05);
      if (this.musicOn) this.startScheduler();
      else this.stopScheduler();
    }
    return this.musicOn;
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    save('td-sfx', this.sfxOn);
    return this.sfxOn;
  }

  // Planlæg toner lidt frem i tiden (så musikken ikke hakker, selv om spillet har travlt)
  startScheduler() {
    if (this.timer || !this.ctx) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.tick(), 25);
  }

  stopScheduler() {
    clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const track = this.tracks[this.trackId];
    if (!track) return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05; // fanen har sovet – spring over
    const stepLen = 60 / (track.bpm * (this.intense ? BOSS_TEMPO : 1)) / 2; // én ottendedel
    while (this.nextTime < now + 0.12) {
      this.playStep(track, this.step, this.nextTime, stepLen);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % STEPS;
    }
  }

  playStep(track, i, t, stepLen) {
    const out = this.musicGain;
    const m = track.melody[i];
    if (m) this.tone(track.lead, m.freq, t, m.len * stepLen * 0.9, 0.5 * track.leadGain, out);
    const b = track.bassline[i];
    if (b) this.tone(track.bass, b.freq, t, b.len * stepLen * 0.9, 0.7 * track.bassGain, out);

    const d = i % 8;
    const intense = this.intense;
    if (track.kick[d] === 'x' || (intense && d % 2 === 0)) this.kick(t, out);
    if (track.snare[d] === 'x') this.snare(t, out, 0.5);
    if (track.hat[d] === 'x' || intense) this.hat(t, out, 0.25);
  }

  // ---------- Lydeffekter ----------

  // Skud fra et tårn. Store tårne (size 2) lyder dybere.
  shot(type, size = 1) {
    if (!this.canPlay(`shot-${type}`, SFX_GAP.shot)) return;
    const t = this.ctx.currentTime;
    const p = size > 1 ? 0.6 : 1; // dybere tone for store tårne
    const out = this.sfxGain;
    switch (type) {
      case 'basic':      // "pew"
        this.sweep('square', 900 * p, 380 * p, t, 0.08, 0.18, out);
        break;
      case 'lightning':  // "zap" med knitren
        this.sweep('sawtooth', 1400 * p, 180 * p, t, 0.16, 0.16, out);
        this.noiseBurst(t, 0.12, 0.3, out, 'bandpass', 3000 * p);
        break;
      case 'sniper':     // hårdt "knald"
        this.noiseBurst(t, 0.09, 0.7, out, 'lowpass', 2500 * p);
        this.sweep('sine', 160 * p, 50, t, 0.15, 0.6, out);
        break;
      case 'poison':     // "blub"
        this.sweep('sine', 260 * p, 620 * p, t, 0.1, 0.35, out);
        this.sweep('sine', 380 * p, 760 * p, t + 0.06, 0.08, 0.2, out);
        break;
    }
  }

  // Øvrige effekter: 'enemyDie', 'lifeLost', 'shatter', 'coreAppear', 'build', 'sell', 'merge', 'coin', 'denied'
  sfx(name) {
    if (!this.canPlay(name, SFX_GAP[name] ?? 0.03)) return;
    const t = this.ctx.currentTime;
    const out = this.sfxGain;
    switch (name) {
      case 'enemyDie':
        this.sweep('square', 520, 140, t, 0.1, 0.12, out);
        break;
      case 'lifeLost':
        this.sweep('square', 220, 90, t, 0.3, 0.3, out);
        this.sweep('square', 233, 95, t, 0.3, 0.2, out);
        break;
      case 'shatter': // metal-skallen knuses
        this.noiseBurst(t, 0.35, 0.8, out, 'highpass', 1500);
        for (const f of [820, 1290, 1930, 2610]) this.tone('sine', f, t, 0.7, 0.15, out, true);
        break;
      case 'coreAppear': // Kernen kommer frem
        this.sweep('sine', 180, 820, t + 0.15, 0.6, 0.4, out);
        this.sweep('triangle', 360, 1640, t + 0.2, 0.55, 0.2, out);
        break;
      case 'build':
        this.tone('square', noteFreq('C6'), t, 0.06, 0.2, out);
        this.tone('square', noteFreq('G6'), t + 0.06, 0.08, 0.2, out);
        break;
      case 'sell':
      case 'coin': // klassisk "mønt"
        this.tone('square', noteFreq('B5'), t, 0.07, 0.22, out);
        this.tone('square', noteFreq('E6'), t + 0.07, 0.2, 0.22, out, true);
        break;
      case 'merge': // opadgående arpeggio
        ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => this.tone('square', noteFreq(n), t + i * 0.06, 0.09, 0.2, out));
        break;
      case 'denied': // "bonk" – ikke råd / kan ikke bygge
        this.tone('square', 150, t, 0.12, 0.25, out);
        break;
    }
  }

  // Må effekten spilles nu? (lyd slået til, lyd klar, og ikke spillet for nylig)
  canPlay(name, gap) {
    if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed[name] ?? -1) < gap) return false;
    this.lastPlayed[name] = now;
    return true;
  }

  // ---------- Byggeklodser ----------

  // En tone med kort anslag og udtoning. decay = true: tonen klinger ud (klokke/mønt)
  tone(type, freq, t, dur, gain, out, decay = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else {
      g.gain.setValueAtTime(gain, t + dur * 0.75);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
    }
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Tone der glider fra én frekvens til en anden
  sweep(type, from, to, t, dur, gain, out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Kort støj gennem et filter (knald, knitren, trommer)
  noiseBurst(t, dur, gain, out, filterType = 'highpass', freq = 1000) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  kick(t, out) {
    this.sweep('sine', 150, 42, t, 0.16, 0.9, out);
  }

  snare(t, out, gain) {
    this.noiseBurst(t, 0.12, gain, out, 'highpass', 1800);
  }

  hat(t, out, gain) {
    this.noiseBurst(t, 0.035, gain, out, 'highpass', 7000);
  }
}

// ---------- Hjælpefunktioner ----------

// 'C#5' → frekvens i Hz
function noteFreq(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Ukendt tone: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(m[3]) + 1) + base + acc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Mønster-tekst → liste med 32 trin: { freq, len } eller null
function parsePattern(text) {
  const tokens = text.split(/\s+/).filter((s) => s && s !== '|');
  const steps = new Array(STEPS).fill(null);
  let last = null;
  tokens.forEach((tok, i) => {
    if (i >= STEPS) return;
    if (tok === '-') { if (last) last.len++; return; }
    if (tok === '.') { last = null; return; }
    last = { freq: noteFreq(tok), len: 1 };
    steps[i] = last;
  });
  return steps;
}

function parseTrack(t) {
  return {
    bpm: t.bpm,
    lead: t.lead,
    bass: t.bass,
    leadGain: t.leadGain ?? 1,
    bassGain: t.bassGain ?? 1,
    melody: parsePattern(t.melody),
    bassline: parsePattern(t.bassline),
    kick: t.kick,
    snare: t.snare,
    hat: t.hat,
  };
}

// 1 sekund hvid støj, genbruges til alle trommer og knald
function makeNoise(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// Husk indstillinger i browseren (kan fejle i privat vindue – så bruges standard)
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignorer – indstillingen huskes bare ikke
  }
}

// Én fælles lydmotor til hele spillet
export const sound = new SoundEngine();

// Til test: tjek at alle melodier har præcis 32 trin
export function checkTracks() {
  const out = {};
  for (const [id, t] of Object.entries(TRACKS)) {
    out[id] = ['melody', 'bassline'].map((k) => t[k].split(/\s+/).filter((s) => s && s !== '|').length);
  }
  return out;
}
