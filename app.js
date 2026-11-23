/* ============================================================
   THE CASTLE LIBRARY — Scriptorium & Rare Vaults
   Procedural Web Audio · 3D Physical Books · Real Photography
   ============================================================ */

'use strict';

const THEMES = {
  fiction: ['#49202a','#2b1118','#efcd90','palmette'],
  history: ['#1b3b33','#10271e','#ead09a','compass'],
  philosophy: ['#28334b','#141d2c','#ead4a1','laurel'],
  essays: ['#532b21','#331912','#e9c487','quill'],
  engineering: ['#20384a','#142330','#f1cea0','astrolabe'],
  investing: ['#343a25','#202417','#e8d09a','scales'],
  poetry: ['#3c3448','#261e30','#ecd3a3','quill'],
  drama: ['#533021','#331a11','#eaca90','cathedral']
};
const FICTION_BINDINGS = [THEMES.fiction, ['#25343b','#111e26','#e5d0a3','quill'], ['#3d2921','#24150f','#edcb8d','palmette'], ['#35352b','#191b14','#ead098','cathedral']];
const ACCESS = {
  lectern: ['Read here','Read'], listed: ['Catalog only','View record']
};
const BOOKS = [...LECTERN_EDITIONS, ...CATALOG_RECORDS].map((book, index) => {
  const variant = [...book.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FICTION_BINDINGS.length;
  const [bg, spine, gold, motif] = book.cat === 'fiction' ? FICTION_BINDINGS[variant] : THEMES[book.cat];
  return {...book, no: String(index + 1).padStart(2, '0'), leather:{bg,spine,gold},motif};
});
const FEATURED = ['meditations','pride','frankenstein','equiano','folktales','seacole','sherlock','walden','alice','wheatley-poems','hound','little-brother'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const normalize = text => String(text).normalize('NFD').replace(/\p{M}/gu,'').replace(/[’‘]/g,"'").toLowerCase();
const byId = Object.fromEntries(BOOKS.map(b => [b.id, b]));
const coverImage = (book, lazy = false) => `<img class="edition-art" src="${esc(book.cover)}" alt="" draggable="false" decoding="async" ${lazy ? 'loading="lazy"' : ''}>`;
const downloadName = book => `${book.title.replace(/[\\/:*?"<>|]/g, '').trim()} - ${book.author.replace(/[\\/:*?"<>|]/g, '').trim()}.epub`;
const matchesCategory = book => activeCategory === 'all' || book.cat === activeCategory || GENRES[activeCategory]?.includes(book.id);

/* ============================================================
   2. HERALDIC MOTIF SVGs
   ============================================================ */
function getMotifSVG(name) {
  switch (name) {
    case 'compass':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="50" cy="50" r="42"/><polygon points="50,14 58,44 86,50 58,56 50,86 42,56 14,50 42,44" fill="currentColor" fill-opacity="0.15"/><circle cx="50" cy="50" r="5" fill="currentColor"/></svg>`;
    case 'astrolabe':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="28"/><line x1="50" y1="10" x2="50" y2="90"/><line x1="10" y1="50" x2="90" y2="50"/><ellipse cx="50" cy="50" rx="36" ry="18" transform="rotate(30 50 50)"/><circle cx="50" cy="50" r="4" fill="currentColor"/></svg>`;
    case 'network':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="20" r="7"/><circle cx="20" cy="70" r="7"/><circle cx="80" cy="70" r="7"/><circle cx="50" cy="52" r="9" fill="currentColor" fill-opacity="0.2"/><line x1="50" y1="27" x2="50" y2="43"/><line x1="26" y1="66" x2="43" y2="56"/><line x1="74" y1="66" x2="57" y2="56"/><line x1="27" y1="70" x2="73" y2="70"/></svg>`;
    case 'laurel':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M50,86 C25,86 16,65 16,42 C16,24 28,14 36,10 C34,22 38,36 50,44 C62,36 66,22 64,10 C72,14 84,24 84,42 C84,65 75,86 50,86 Z"/><circle cx="50" cy="48" r="7" fill="currentColor"/></svg>`;
    case 'scales':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="50" y1="14" x2="50" y2="86"/><line x1="20" y1="30" x2="80" y2="30"/><path d="M20,30 L10,60 H30 Z"/><path d="M80,30 L70,60 H90 Z"/><path d="M35,86 H65"/></svg>`;
    case 'lattice':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="18" y="18" width="64" height="64"/><line x1="18" y1="18" x2="82" y2="82"/><line x1="82" y1="18" x2="18" y2="82"/><circle cx="50" cy="50" r="14"/><rect x="36" y="36" width="28" height="28"/></svg>`;
    case 'palmette':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50,90 V20 M50,20 Q30,40 18,65 M50,20 Q70,40 82,65 M50,45 Q25,60 16,84 M50,45 Q75,60 84,84"/><circle cx="50" cy="20" r="6" fill="currentColor"/></svg>`;
    case 'hourglass':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="24,18 76,18 50,50" fill="currentColor" fill-opacity="0.1"/><polygon points="24,82 76,82 50,50" fill="currentColor" fill-opacity="0.25"/><line x1="16" y1="18" x2="84" y2="18"/><line x1="16" y1="82" x2="84" y2="82"/></svg>`;
    case 'cathedral':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22,86 V48 L50,14 L78,48 V86 Z"/><path d="M36,86 V60 Q50,44 64,60 V86"/><circle cx="50" cy="38" r="9"/></svg>`;
    case 'clockwork':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="10" fill="currentColor"/><path d="M50,12 V20 M50,80 V88 M12,50 H20 M80,50 H88 M23,23 L29,29 M71,71 L77,77 M23,77 L29,71 M71,29 L77,23"/></svg>`;
    case 'quill':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M84,14 C65,22 40,45 28,70 L20,86 L36,78 C52,65 72,40 84,14 Z"/><line x1="20" y1="86" x2="44" y2="62"/></svg>`;
    case 'ornithopter':
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><path d="M50,75 L50,25 M50,35 Q20,10 10,40 Q25,48 50,42 M50,35 Q80,10 90,40 Q75,48 50,42"/><ellipse cx="50" cy="55" rx="5" ry="18"/></svg>`;
    default:
      return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2"><circle cx="50" cy="50" r="38"/></svg>`;
  }
}

/* ============================================================
   3. PROCEDURAL WEB AUDIO ENGINE (ZERO EXTERNAL ASSETS)
   ============================================================ */
let audioCtx = null;
let soundEnabled = false;
let ambientGain = null;
let hearthBufferSource = null;

function initAudio() {
  if (audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  try { audioCtx = new AudioContext(); } catch { /* Audio is optional. */ }
  if (audioCtx) loadPageSample();
}

let paperNoise = null;
let pageSample = null;
let pageSampleLoading = false;

let musicOn = true;
let pageSoundOn = true;
let musicMaster = null;
let musicTimer = null;
try {
  pageSoundOn = localStorage.getItem('castle_page_sound') !== 'false';
  musicOn = localStorage.getItem('castle_music') !== 'false';
} catch {}

function paperBuffer() {
  if (paperNoise) return paperNoise;
  const len = Math.floor(audioCtx.sampleRate * 1.2);
  paperNoise = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = paperNoise.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.06 * white) / 1.06; // soft, brown-ish grain
    data[i] = white * 0.35 + last * 2.2;
  }
  return paperNoise;
}

async function loadPageSample() {
  if (pageSample || pageSampleLoading || !audioCtx) return;
  pageSampleLoading = true;
  try {
    const response = await fetch('audio/newspaper-page-flip.mp3');
    if (!response.ok) throw Error('missing');
    pageSample = await audioCtx.decodeAudioData(await response.arrayBuffer());
  } catch (e) { pageSample = null; }
  pageSampleLoading = false;
}

function playPageSample() {
  const source = audioCtx.createBufferSource();
  source.buffer = pageSample;
  source.playbackRate.value = 0.96 + Math.random() * 0.08;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.85;
  source.connect(gain); gain.connect(audioCtx.destination);
  source.start();
}

function playPageFlipSound() {
  if (!pageSoundOn || !audioCtx) return;
  if (pageSample) { try { if (audioCtx.state === 'suspended') audioCtx.resume(); playPageSample(); return; } catch (e) {} }
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    // 1. Air sweep as the leaf lifts and slides across the page
    const air = audioCtx.createBufferSource();
    air.buffer = paperBuffer();
    const airFilter = audioCtx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.Q.value = 0.9;
    airFilter.frequency.setValueAtTime(700, t);
    airFilter.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    airFilter.frequency.exponentialRampToValueAtTime(900, t + 0.7);
    const airGain = audioCtx.createGain();
    airGain.gain.setValueAtTime(0.0001, t);
    airGain.gain.exponentialRampToValueAtTime(0.22, t + 0.09);
    airGain.gain.exponentialRampToValueAtTime(0.06, t + 0.35);
    airGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    air.connect(airFilter); airFilter.connect(airGain); airGain.connect(audioCtx.destination);
    air.start(t, Math.random() * 0.5, 0.8);
    // 2. Crinkles: tiny irregular grains of paper fibres
    const crinkle = audioCtx.createBufferSource();
    crinkle.buffer = paperBuffer();
    const crinkleHp = audioCtx.createBiquadFilter();
    crinkleHp.type = 'highpass';
    crinkleHp.frequency.value = 2400;
    const crinkleGain = audioCtx.createGain();
    crinkleGain.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 18; i++) {
      const at = t + 0.04 + Math.pow(Math.random(), 1.6) * 0.5;
      const amp = 0.05 + Math.random() * 0.11;
      crinkleGain.gain.setValueAtTime(amp, at);
      crinkleGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.006 + Math.random() * 0.01);
    }
    crinkle.connect(crinkleHp); crinkleHp.connect(crinkleGain); crinkleGain.connect(audioCtx.destination);
    crinkle.start(t, Math.random() * 0.6, 0.6);
    // 3. Settle: the leaf lands softly on the stack
    const settle = audioCtx.createBufferSource();
    settle.buffer = paperBuffer();
    const settleLp = audioCtx.createBiquadFilter();
    settleLp.type = 'lowpass';
    settleLp.frequency.value = 650;
    const settleGain = audioCtx.createGain();
    settleGain.gain.setValueAtTime(0.0001, t + 0.52);
    settleGain.gain.exponentialRampToValueAtTime(0.16, t + 0.56);
    settleGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    settle.connect(settleLp); settleLp.connect(settleGain); settleGain.connect(audioCtx.destination);
    settle.start(t + 0.52, 0.0, 0.2);
  } catch (e) {}
}

function playBookSlideSound() {
  if (!pageSoundOn || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const dur = 0.22;
    const bufferSize = Math.floor(audioCtx.sampleRate * dur);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufferSize * Math.PI) * 0.28;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(240, now + dur);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
  } catch (e) {}
}

function playBookThudSound() {
  if (!pageSoundOn || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch (e) {}
}

/* Background instrumental: slow pads, plucked melody and a soft room echo, generated live */
const MUSIC_CHORDS = [
  [50, 57, 60, 64, 69],   // Dm9
  [46, 50, 53, 57],       // Bbmaj7
  [43, 50, 53, 58],       // Gm7
  [45, 52, 57, 61],       // A7sus-ish voicing
];
const MUSIC_SCALE = [62, 64, 65, 69, 70, 72, 74, 76];   // D minor / Dorian colour

const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);

function buildMusicBus() {
  if (musicMaster) return musicMaster;
  musicMaster = audioCtx.createGain();
  musicMaster.gain.value = 0.0001;
  const delay = audioCtx.createDelay(1.2);
  delay.delayTime.value = 0.42;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.32;
  const tone = audioCtx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2400;
  const reverb = audioCtx.createConvolver();
  const length = audioCtx.sampleRate * 3.2;
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
  }
  reverb.buffer = impulse;
  const wet = audioCtx.createGain();
  wet.gain.value = 0.55;
  musicMaster.connect(tone);
  tone.connect(audioCtx.destination);
  tone.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(audioCtx.destination);
  tone.connect(reverb); reverb.connect(wet); wet.connect(audioCtx.destination);
  return musicMaster;
}

function playPad(notes, start, length) {
  const bus = musicMaster;
  notes.forEach((note, i) => {
    const osc = audioCtx.createOscillator();
    const detune = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiHz(note);
    detune.frequency.value = 0.12 + i * 0.03;
    const depth = audioCtx.createGain();
    depth.gain.value = 2.5;
    detune.connect(depth); depth.connect(osc.detune);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045 / Math.sqrt(notes.length), start + 2.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length + 2.5);
    osc.connect(gain); gain.connect(bus);
    osc.start(start); detune.start(start);
    osc.stop(start + length + 3); detune.stop(start + length + 3);
  });
}

function playPluck(note, when) {
  const osc = audioCtx.createOscillator();
  const overtone = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const over = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = midiHz(note);
  overtone.type = 'sine';
  overtone.frequency.value = midiHz(note) * 2;
  over.gain.value = 0.12;
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.12, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 2.6);
  osc.connect(gain); overtone.connect(over); over.connect(gain); gain.connect(musicMaster);
  osc.start(when); overtone.start(when);
  osc.stop(when + 2.7); overtone.stop(when + 2.7);
}

function scheduleMusic() {
  if (!musicOn || !audioCtx || !musicMaster) return;
  const horizon = audioCtx.currentTime + 1.2;
  while (nextChordAt < horizon) {
    const chord = MUSIC_CHORDS[chordIndex % MUSIC_CHORDS.length];
    playPad(chord, nextChordAt, 8);
    nextChordAt += 8;
    chordIndex++;
  }
  while (nextNoteAt < horizon) {
    const pick = MUSIC_SCALE[Math.floor(Math.random() * MUSIC_SCALE.length)];
    if (Math.random() < 0.8) playPluck(pick, nextNoteAt);
    nextNoteAt += 1.4 + Math.random() * 2.2;
  }
}

let nextChordAt = 0;
let nextNoteAt = 0;
let chordIndex = 0;

function startMusic() {
  if (!musicOn) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  buildMusicBus();
  if (!musicTimer) {
    nextChordAt = audioCtx.currentTime + 0.3;
    nextNoteAt = audioCtx.currentTime + 2.5;
    musicTimer = setInterval(scheduleMusic, 300);
    scheduleMusic();
  }
  musicMaster.gain.cancelScheduledValues(audioCtx.currentTime);
  musicMaster.gain.setValueAtTime(musicMaster.gain.value, audioCtx.currentTime);
  musicMaster.gain.linearRampToValueAtTime(0.85, audioCtx.currentTime + 3);
}

function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!musicMaster || !audioCtx) return;
  musicMaster.gain.cancelScheduledValues(audioCtx.currentTime);
  musicMaster.gain.setValueAtTime(musicMaster.gain.value, audioCtx.currentTime);
  musicMaster.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
}

function toggleMusic() {
  musicOn = !musicOn;
  try { localStorage.setItem('castle_music', String(musicOn)); } catch {}
  syncAudioControls();
  if (musicOn) { startMusic(); showToast('Background music playing. Press again to silence it.'); }
  else { stopMusic(); showToast('Background music silenced.'); }
}

function togglePageSound() {
  pageSoundOn = !pageSoundOn;
  try { localStorage.setItem('castle_page_sound', String(pageSoundOn)); } catch {}
  syncAudioControls();
  if (pageSoundOn) { initAudio(); if (audioCtx?.state === 'suspended') audioCtx.resume(); playPageFlipSound(); }
  showToast(pageSoundOn ? 'Page-turn sounds on.' : 'Page-turn sounds off.');
}

function syncAudioControls() {
  const m = document.getElementById('musicToggle');
  if (m) {
    m.setAttribute('aria-pressed', String(musicOn));
    m.title = musicOn ? 'Turn background music off' : 'Turn background music on';
    m.querySelector('.btn-icon').textContent = musicOn ? '🎵' : '🔇';
    m.querySelector('.btn-txt').textContent = musicOn ? 'MUSIC ON' : 'MUSIC OFF';
  }
  const lp = document.getElementById('lecternSoundBtn');
  if (lp) {
    lp.setAttribute('aria-pressed', String(pageSoundOn));
    lp.title = pageSoundOn ? 'Turn page-turn sounds off' : 'Turn page-turn sounds on';
    lp.querySelector('.tool-icon').textContent = pageSoundOn ? '🔊' : '🔇';
    lp.querySelector('.tool-label').textContent = pageSoundOn ? 'PAGE SOUND' : 'PAGE MUTED';
  }
}

/* Ambient Hearth & Leaded-Glass Rain Soundscape */
function toggleSoundscape() {
  initAudio();
  soundEnabled = !soundEnabled;
  const icon = document.getElementById('soundIcon');
  const label = document.getElementById('soundLabel');
  if (soundEnabled) {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    icon.textContent = '🔊';
    label.textContent = 'SOUND ACTIVE';
    startAmbientNoise();
    showToast('Castle soundscape & page audio activated.');
  } else {
    icon.textContent = '🔇';
    label.textContent = 'SOUNDSCAPE';
    stopAmbientNoise();
    showToast('Castle soundscape silenced.');
  }
}

function startAmbientNoise() {
  if (!audioCtx) return;
  try {
    const dur = 4.0;
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      // Pink noise for soft rain
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      // Random hearth crackle pops
      if (Math.random() < 0.0006) {
        data[i] += (Math.random() * 0.8 - 0.4);
      }
    }
    hearthBufferSource = audioCtx.createBufferSource();
    hearthBufferSource.buffer = buffer;
    hearthBufferSource.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 750;
    ambientGain = audioCtx.createGain();
    ambientGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    ambientGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 1.2);
    hearthBufferSource.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);
    hearthBufferSource.start();
  } catch (e) {}
}

function stopAmbientNoise() {
  if (ambientGain && audioCtx) {
    try {
      ambientGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      setTimeout(() => {
        if (hearthBufferSource) {
          try { hearthBufferSource.stop(); hearthBufferSource.disconnect(); } catch (e) {}
          hearthBufferSource = null;
        }
      }, 550);
    } catch (e) {}
  }
}

/* ============================================================
   4. DUST MOTES FLOATING CANVAS
   ============================================================ */
function initDustCanvas() {
  const canvas = document.getElementById('dustCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let w, h;
  function fitCanvas() {
    w = canvas.width = canvas.clientWidth;
    h = canvas.height = canvas.clientHeight;
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  const motes = Array.from({ length: 45 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 1.8 + 0.6,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: -Math.random() * 0.35 - 0.08,
    alpha: Math.random() * 0.6 + 0.2,
    phase: Math.random() * Math.PI * 2
  }));

  let lastFrame = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    if (document.hidden || document.body.classList.contains('reading-open') || reducedMotion.matches || now - lastFrame < 32) return;
    lastFrame = now;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.speedX + Math.sin(m.phase) * 0.15;
      m.y += m.speedY;
      m.phase += 0.015;
      if (m.y < -10) m.y = h + 10;
      if (m.x < -10) m.x = w + 10;
      if (m.x > w + 10) m.x = -10;

      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 215, 130, ${m.alpha * 0.75})`;
      ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
  }
  requestAnimationFrame(animate);
}

/* ============================================================
   5. CHAMBER SWITCHER & CANDLELIGHT ENGINE
   ============================================================ */
function initAtmosphereControls() {
  // Chamber Switcher
  const chamberSelect = document.getElementById('chamberSelect');
  if (chamberSelect) {
    chamberSelect.addEventListener('change', e => {
      const chamber = e.target.value;
      document.querySelectorAll('.chamber-bg').forEach(bg => bg.classList.remove('active'));
      const activeBg = document.querySelector(`.chamber-${chamber}`);
      if (activeBg) activeBg.classList.add('active');
      showToast(`Chamber relocated to: ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  // Candlelight / Daylight Toggle
  const candleToggle = document.getElementById('candleToggle');
  const candleLabel = document.getElementById('candleLabel');
  if (candleToggle) {
    candleToggle.addEventListener('click', () => {
      document.body.classList.toggle('daylight-mode');
      const isDay = document.body.classList.contains('daylight-mode');
      candleLabel.textContent = isDay ? 'DAYLIGHT' : 'CANDLELIGHT';
      showToast(isDay ? 'Daylight illuminates the leaded windows.' : 'Midnight candlelight rekindled.');
    });
  }

  // Both controls drive the same flame and the same room-lighting state.
  const heroCandle = document.getElementById('heroCandle');
  const lecternCandle = document.getElementById('lecternCandle');
  const caption = document.getElementById('candleCaption');
  const deskLabel = document.getElementById('lecternCandleLabel');
  function setCandle(lit) {
    document.body.classList.toggle('candle-out', !lit);
    heroCandle.setAttribute('aria-pressed', String(lit));
    lecternCandle.setAttribute('aria-pressed', String(lit));
    lecternCandle.title = lit ? 'Snuff the reading candles' : 'Light the reading candles';
    caption.textContent = lit ? 'Flame lit · Snuff candle' : 'Flame out · Relight candle';
    deskLabel.textContent = lit ? 'FLAME ON' : 'FLAME OFF';
    try { localStorage.setItem('castle_candle_lit', String(lit)); } catch {}
  }
  if (heroCandle && lecternCandle && caption && deskLabel) {
    let lit = true;
    try { lit = localStorage.getItem('castle_candle_lit') !== 'false'; } catch {}
    setCandle(lit);
    const toggle = () => setCandle(document.body.classList.contains('candle-out'));
    heroCandle.addEventListener('click', toggle);
    lecternCandle.addEventListener('click', toggle);
  }

  // Castle Soundscape Toggle
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', toggleSoundscape);
  }
  const musicToggle = document.getElementById('musicToggle');
  if (musicToggle) musicToggle.addEventListener('click', toggleMusic);
  syncAudioControls();
  // Browsers only allow audio after a visitor interacts with the page.
  const beginMusic = () => {
    if (musicOn) startMusic();
    document.removeEventListener('pointerdown', beginMusic);
    document.removeEventListener('keydown', beginMusic);
  };
  document.addEventListener('pointerdown', beginMusic);
  document.addEventListener('keydown', beginMusic);
}

/* ============================================================
   6. PHYSICAL CARVED OAK BOOKSHELF RENDERING
   ============================================================ */
let shelfMode = 'face'; // 'face' or 'spine'

function renderShelfBooks() {
  const rail = document.getElementById('shelfRail');
  if (!rail) return;
  rail.innerHTML = '';

  FEATURED.map(id => byId[id]).filter(Boolean).forEach((book, index) => {
    const tiltDegrees = [-1.8, 1.4, -0.9, 1.8, -1.5, 0.8, -2.1, 1.6][index % 8];
    const item = document.createElement('div');
    item.className = `shelf-book-item mode-${shelfMode}`;
    item.dataset.id = book.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', book.title + ' by ' + book.author);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
    item.style.setProperty('--tilt', `${tiltDegrees}deg`);
    item.style.setProperty('--leather-bg', book.leather.bg);
    item.style.setProperty('--leather-spine', book.leather.spine);
    item.style.setProperty('--leather-gold', book.leather.gold);

    if (shelfMode === 'face') {
      item.innerHTML = `
        <div class="book-3d-wrapper">
          <!-- 3D Spine Thickness on Left -->
          <div class="book-spine-depth">
            <div class="spine-hub"></div>
            <div class="spine-text-vertical">${esc(book.title.toUpperCase())}</div>
            <div class="spine-hub"></div>
          </div>

          <!-- Front Leather Cover -->
          <div class="book-face-cover${book.cover ? ' has-edition-art' : ''}">
            ${book.cover ? coverImage(book) : `
            <div class="cover-gold-filigree"></div>
            <div class="cover-header-tag">TOME ${book.no} · ${book.cat.toUpperCase()}</div>
            <div class="cover-heraldic-motif">${getMotifSVG(book.motif)}</div>
            <div class="cover-titles-wrap">
              <div class="cover-book-title">${esc(book.title)}</div>
              <div class="cover-book-author">${esc(book.author)}</div>
            </div>
            <div class="cover-footer-meta">
              <span>VOL. ${book.no}</span>
              <span>${esc(book.year)}</span>
            </div>`}
          </div>

          <!-- Gilded Page Block on Right -->
          <div class="book-pages-depth"></div>
        </div>
        <div class="book-shelf-shadow"></div>
      `;
    } else {
      // Classic Spine Stack mode
      item.innerHTML = `
        <div class="book-3d-wrapper">
          <div class="book-face-cover" style="padding:10px 4px;justify-content:space-between;border-radius:4px;">
            <div class="spine-hub"></div>
            <div class="cover-header-tag" style="font-size:7px;">№ ${book.no}</div>
            <div class="spine-text-vertical" style="font-size:10.5px;">${esc(book.title.toUpperCase())}</div>
            <div class="cover-book-author" style="font-size:8px;">${esc(book.author)}</div>
            <div class="spine-hub"></div>
          </div>
        </div>
        <div class="book-shelf-shadow"></div>
      `;
    }

    // Audio & hover reactions
    item.addEventListener('mouseenter', () => {
      initAudio();
      playBookSlideSound();
    });

    item.addEventListener('click', () => {
      initAudio();
      playBookSlideSound();
      openLecternBook(book);
    });

    rail.appendChild(item);
  });
}

function initShelfInteractions() {
  const viewport = document.getElementById('shelfViewport');
  const scrollLeftBtn = document.getElementById('shelfScrollLeft');
  const scrollRightBtn = document.getElementById('shelfScrollRight');
  const modeFaceBtn = document.getElementById('modeFace');
  const modeSpineBtn = document.getElementById('modeSpine');

  if (scrollLeftBtn && viewport) {
    scrollLeftBtn.addEventListener('click', () => {
      initAudio();
      playBookSlideSound();
      viewport.scrollBy({ left: -360, behavior: 'smooth' });
    });
  }

  if (scrollRightBtn && viewport) {
    scrollRightBtn.addEventListener('click', () => {
      initAudio();
      playBookSlideSound();
      viewport.scrollBy({ left: 360, behavior: 'smooth' });
    });
  }

  // Shelf Mode buttons
  if (modeFaceBtn && modeSpineBtn) {
    modeFaceBtn.addEventListener('click', () => {
      shelfMode = 'face';
      modeFaceBtn.classList.add('active');
      modeSpineBtn.classList.remove('active');
      renderShelfBooks();
    });

    modeSpineBtn.addEventListener('click', () => {
      shelfMode = 'spine';
      modeSpineBtn.classList.add('active');
      modeFaceBtn.classList.remove('active');
      renderShelfBooks();
    });
  }

  // Drag-to-scroll on bookshelf viewport
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  if (viewport) {
    viewport.addEventListener('mousedown', e => {
      isDown = true;
      viewport.classList.add('is-dragging');
      startX = e.pageX - viewport.offsetLeft;
      scrollLeft = viewport.scrollLeft;
    });

    viewport.addEventListener('mouseleave', () => {
      isDown = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('mouseup', () => {
      isDown = false;
      viewport.classList.remove('is-dragging');
    });

    viewport.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - viewport.offsetLeft;
      const walk = (x - startX) * 1.5;
      viewport.scrollLeft = scrollLeft - walk;
    });
  }
}

/* ============================================================
   7. THE COMPLETE VAULT CATALOG & SEARCH
   ============================================================ */
let activeCategory = 'all';
let searchFilter = '';
let accessFilter = 'all';
let catalogPage = 0;
const pageSize = 12;
const isFree = book => book.access === 'lectern';

function renderVaultGrid() {
  pgRequest?.abort();
  const request = new AbortController();
  pgRequest = request;
  const grid = $('vaultGrid');
  const lang = $('pgLanguage').value, type = $('pgKind').value;
  const terms = normalize(searchFilter).split(/\s+/).filter(Boolean);
  const local = ((!lang || lang === 'en') && (!type || type === 'Text')) ? BOOKS.filter(book => {
    const matchesAccess = accessFilter === 'all' || (accessFilter === 'read' && isFree(book)) ||
      (accessFilter === 'epub' && !!book.download) || (accessFilter === 'record' && !isFree(book) && !book.download);
    const haystack = normalize([book.title, book.author, book.tagline, book.cat].filter(Boolean).join(' '));
    return matchesAccess && matchesCategory(book) && terms.every(term => haystack.includes(term));
  }) : [];
  const start = catalogPage * pageSize;
  const first = local.slice(start,start + pageSize);
  const makeCards = books => grid.replaceChildren(...books.map(renderCatalogCard));
  const params = new URLSearchParams({q:searchFilter,lang,type,access:accessFilter,topic:activeCategory,
    offset:Math.max(0,start - local.length), limit:pageSize - first.length});
  $('catalogCount').textContent = 'Searching the collection…';
  grid.setAttribute('aria-busy','true');
  $('catalogPagination').hidden = true;
  makeCards(first);

  function finish(total, books, fallback = false) {
    const pages = Math.max(1,Math.ceil(total / pageSize));
    if (catalogPage >= pages) { catalogPage = pages - 1; return renderVaultGrid(); }
    $('catalogCount').textContent = `${countText(total)} ${total === 1 ? 'catalog record' : 'catalog records'}${fallback ? ' · Some records are temporarily unavailable' : ''}`;
    $('catalogPagination').hidden = pages <= 1;
    $('catalogPage').textContent = `${countText(catalogPage + 1)} / ${countText(pages)}`;
    $('catalogPrev').disabled = catalogPage === 0;
    $('catalogNext').disabled = catalogPage + 1 >= pages;
    const jump = $('catalogJumpPage'); jump.max = pages; jump.value = catalogPage + 1;
    makeCards(books);
    if (!books.length || fallback) {
      const note = document.createElement('p');
      note.className = 'empty-catalog';
      note.textContent = fallback ? 'The full collection couldn’t be reached. ' : 'No matching records. Try a different search or clear a filter.';
      if (fallback) {
        const retry = Object.assign(document.createElement('button'),{type:'button',className:'filter-tag',textContent:'Retry search'});
        retry.onclick = renderVaultGrid;
        note.append(retry);
      }
      grid.append(note);
    }
  }
  const timer = setTimeout(() => request.abort('timeout'),10000);
  archiveJson(`${archiveApi}?${params}`,{signal:request.signal}).then(data => {
    if (pgRequest !== request) return;
    finish(local.length + data.count,[...first,...data.items.map(makeGutenbergBook)]);
  }).catch(() => {
    if (pgRequest !== request || (request.signal.aborted && request.signal.reason !== 'timeout')) return;
    if (catalogPage >= Math.max(1,Math.ceil(local.length/pageSize))) catalogPage = 0;
    finish(local.length,local.slice(catalogPage*pageSize,(catalogPage+1)*pageSize),true);
  }).finally(() => {
    clearTimeout(timer);
    if (pgRequest === request) grid.removeAttribute('aria-busy');
  });
}

function renderCatalogCard(book) {
  const card = document.createElement('article');
  card.className = 'accession-card';
  card.dataset.id = book.id;
  card.style.setProperty('--leather-bg', book.leather.bg);
  card.style.setProperty('--leather-gold', book.leather.gold);
  const [badge, label] = book.gutenberg ? [book.access === 'lectern' ? 'Free to read' : 'Catalog record', book.access === 'lectern' ? 'Read here' : 'View record'] : ACCESS[book.access];
  const action = `<button class="card-read-btn" type="button">${label}</button>`;
  const download = book.download ? `<a class="card-download-btn" href="${esc(book.download)}" download="${esc(downloadName(book))}" aria-label="Download ${esc(book.title)} as EPUB">↓ EPUB</a>` : '';
  card.innerHTML = `
    <div class="card-gilt-corner top-left"></div><div class="card-gilt-corner top-right"></div>
    <div class="card-gilt-corner bottom-left"></div><div class="card-gilt-corner bottom-right"></div>
    <div class="card-book-mini${book.cover ? ' has-edition-art' : ''}" aria-hidden="true">
      ${book.cover ? coverImage(book, true) : `<span class="mini-tome-no">TOME ${book.no}</span>
      <span class="mini-tome-title">${esc(book.title)}</span><span class="mini-tome-author">${esc(book.author)}</span>`}
    </div>
    <div class="card-info">
      <div class="card-tag-line"><span class="card-vault-tag" data-access="${book.access}">${badge}</span><span class="card-year-stamp">${esc(book.year)}</span></div>
      <h3 class="card-book-heading">${esc(book.title)}</h3>
      <p class="card-book-byline">${esc(book.author)}</p>
      <p class="card-book-motto">${esc(book.gutenberg ? [book.kind,...(book.languageNames || []).slice(0,2)].filter(Boolean).join(' · ') : book.access === 'listed' ? 'Not available to read here' : book.cover ? 'Official edition cover' : 'Castle binding')}</p>
      <div class="card-action-bar">${action}${download}<button class="card-save-btn" type="button" aria-pressed="${studyList.includes(book.id)}">${studyList.includes(book.id) ? 'IN STUDY ✓' : '+ TO STUDY'}</button></div>
    </div>`;
  card.querySelector('.card-book-mini').addEventListener('click', () => openCatalogBook(book));
  card.querySelector('.card-read-btn').addEventListener('click', () => openCatalogBook(book));
  if (book.gutenberg && book.download) card.querySelector('.card-download-btn').addEventListener('click', e => downloadGutenberg(e, book));
  const save = card.querySelector('.card-save-btn');
  save.addEventListener('click', () => toggleSaveBook(book.id));
  return card;
}

let pgRequest;
let pgSearchTimer;
let pgDownloadPending = new Set();
const archiveApi = 'api/gutenberg';
const countText = value => Number(value).toLocaleString();
const langDisplay = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], {type:'language'}) : null;
const languageName = code => { try { return langDisplay?.of(code) || code; } catch { return code; } };

async function archiveJson(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { throw Error('The library catalog couldn’t be reached. Please try again.'); }
  if (!response.ok) throw Error(data.error || 'The library catalog couldn’t be reached. Please try again.');
  return data;
}

function makeGutenbergBook(item) {
  const id = `pg-${item.id}`;
  const root = `${archiveApi}/${item.id}`;
  const theme = FICTION_BINDINGS[item.id % FICTION_BINDINGS.length];
  const [bg,spine,gold,motif] = theme;
  const book = {
    id, no: String(item.id), title: item.title, author:item.author || 'Author not listed', kind:item.kind,
    languageNames:(item.languages || []).map(languageName), gutenberg:true, year:'', cat:'fiction', access:item.read ? 'lectern' : 'listed',
    download:item.download ? `${root}/epub` : '', chapterManifest:item.read ? `${root}/read` : '', chunkBase:`${root}/pages`,
    source:'', sourceName:'Castle Library', license:'',
    tagline:(item.subjects || []).slice(0,3).join(' · '), leather:{bg,spine,gold}, motif
  };
  byId[id] = book;
  return book;
}

function openCatalogBook(book) { openLecternBook(book); }

async function downloadGutenberg(event, book) {
  event.preventDefault();
  if (pgDownloadPending.has(book.id)) return;
  pgDownloadPending.add(book.id);
  const control = event.currentTarget;
  control.setAttribute('aria-busy','true');
  showToast('Preparing your EPUB…');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),150000);
  try {
    const response = await fetch(book.download,{signal:controller.signal});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Error(data.error || 'This EPUB is unavailable.');
    }
    if (!response.headers.get('Content-Type')?.startsWith('application/epub+zip')) throw Error('The archive didn’t return an EPUB.');
    const local = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'),{href:local,download:downloadName(book)});
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(local),30000);
    showToast('EPUB downloaded.');
  } catch (error) {
    showToast(error.name === 'AbortError' ? 'The download took too long. Try again shortly.' : error.message);
  } finally {
    clearTimeout(timer);
    control.removeAttribute('aria-busy');
    pgDownloadPending.delete(book.id);
  }
}

function initVaultFilters() {
  const search = document.getElementById('vaultSearchInput');
  if (search && window.matchMedia('(max-width: 600px)').matches) search.placeholder = 'Search books or authors…';
  const ribbons = document.getElementById('filterRibbons');
  const input = document.getElementById('vaultSearchInput');
  const clear = document.getElementById('clearSearch');
  const refresh = () => { catalogPage = 0; renderVaultGrid(); };
  $('catalogJumpForm').addEventListener('submit', e => {
    e.preventDefault(); catalogPage = Math.max(0,Number($('catalogJumpPage').value)-1); renderVaultGrid();
  });
  for (const field of ['pgLanguage','pgKind']) $(field).addEventListener('change',refresh);
  archiveJson(`${archiveApi}/meta`).then(meta => {
    $('catalogTotal').textContent = countText(BOOKS.length + meta.total);
    $('fullTotal').textContent = countText(BOOKS.filter(isFree).length + meta.reading);
    for (const [id, options, display] of [['pgLanguage',meta.languages,languageName],['pgKind',meta.types,v=>v]]) {
      const select = $(id), selected = select.value;
      for (const [value] of options) if (![...select.options].some(option=>option.value===value)) select.append(new Option(display(value),value));
      select.value = selected;
    }
  }).catch(() => {});
  ribbons.querySelector('[data-cat="all"]').textContent = 'All subjects';
  const genres = $('genreFilter');
  const markCategory = () => ribbons.querySelectorAll('.filter-tag').forEach(tag => {
    const selected = tag.dataset.cat === activeCategory;
    tag.classList.toggle('active', selected);
    tag.setAttribute('aria-pressed', selected);
  });
  markCategory();
  ribbons.addEventListener('click', e => {
    const tag = e.target.closest('.filter-tag');
    if (!tag) return;
    activeCategory = tag.dataset.cat;
    genres.value = '';
    markCategory();
    refresh();
  });
  genres.addEventListener('change', () => { activeCategory = genres.value || 'all'; markCategory(); refresh(); });
  input.addEventListener('input', () => {
    searchFilter = input.value.trim(); clear.hidden = !searchFilter;
    clearTimeout(pgSearchTimer);
    pgRequest?.abort(); pgSearchTimer = setTimeout(refresh,180);
  });
  clear.addEventListener('click', () => { input.value = ''; input.focus(); input.dispatchEvent(new Event('input')); });
  document.getElementById('accessFilter').addEventListener('change', e => { accessFilter = e.target.value; refresh(); });
  const navigate = by => { catalogPage += by; renderVaultGrid(); document.getElementById('vaultGrid').scrollIntoView({block:'start'}); };
  document.getElementById('catalogPrev').addEventListener('click', () => navigate(-1));
  document.getElementById('catalogNext').addEventListener('click', () => navigate(1));
  document.getElementById('catalogTotal').textContent = BOOKS.length;
  document.getElementById('fullTotal').textContent = BOOKS.filter(isFree).length;
}

/* ============================================================
   8. GRAND READING LECTERN (3D BOOK MODAL)
   ============================================================ */
let activeBook = null;
let currentLeaf = 0;
let pairs = [];
let leaves = new Map();
let readingPages = [];
let ready = false;
let turning = false;
let session = 0;
let returnFocus = null;
let openedFromCover = null;
let positions = {};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
try { positions = JSON.parse(localStorage.getItem('castle_read_positions') || '{}') || {}; } catch {}

function savePosition(book, page) {
  if (!page || book.access !== 'lectern') return;
  positions[book.id] = page;
  try { localStorage.setItem('castle_read_positions', JSON.stringify(positions)); } catch {}
}

// Text is paginated offline. Only the small chunk around the reader is fetched,
// and the first two pages are already in the catalog manifest.
let readingAbort;
let chunkLoads = new Map();
let paging = false;
let resumeTask;

function foliosAt(index) {
  return [pairs[index - 1]?.[1], pairs[index]?.[0]]
    .filter(n => n > 0 && n <= readingPages.length);
}

function loadChunkFor(page) {
  const book = activeBook;
  if (!book || !page || readingPages[page - 1]) return Promise.resolve();
  const size = book.pageChunkSize;
  const number = Math.floor((page - 1) / size);
  const base = number * size;
  if (chunkLoads.has(number)) return chunkLoads.get(number);
  const targetPages = readingPages;
  const abort = new AbortController();
  const parent = readingAbort.signal;
  const cancel = () => abort.abort();
  if (parent.aborted) cancel();
  else parent.addEventListener('abort', cancel, {once:true});
  const timeout = setTimeout(cancel, 8000);
  const requests = chunkLoads;
  const request = fetch(`${book.chunkBase || `pages/${book.id}`}/${number}.json`, { signal: abort.signal })
    .then(response => {
      if (!response.ok) throw new Error('This section could not load');
      return response.json();
    }).then(chunk => {
      if (!Array.isArray(chunk) || chunk.length !== Math.min(size, targetPages.length - base) || !chunk.every(Array.isArray)) throw new Error('Invalid reading section');
      chunk.forEach((pageText, offset) => { targetPages[base + offset] = pageText; });
      if (targetPages === readingPages && !parent.aborted) refreshPreparedPages();
    }).finally(() => {
      clearTimeout(timeout);
      parent.removeEventListener('abort', cancel);
      requests.delete(number);
    });
  requests.set(number, request);
  return request;
}

function refreshPreparedPages() {
  for (const leaf of leaves.values()) {
    for (const face of leaf.children) {
      const placeholder = face.querySelector('[data-page-placeholder]');
      const folio = Number(placeholder?.dataset.pagePlaceholder);
      if (folio && readingPages[folio - 1]) face.innerHTML = pageHTML(folio);
    }
  }
}

function prefetchNextSpread() {
  if (!ready || !activeBook) return;
  const lookAhead = foliosAt(currentLeaf + 2).find(folio => !readingPages[folio - 1]);
  if (lookAhead) loadChunkFor(lookAhead).catch(() => {});
}

function withSpread(index, action) {
  if (!ready || turning || paging) return;
  const missing = foliosAt(index).filter(folio => !readingPages[folio - 1]);
  const message = $('readerMessage');
  if (!missing.length) {
    if (!(activeBook.chapterManifest && !readingPages.length)) message.hidden = true;
    action();
    return;
  }
  paging = true;
  updateReaderButtons();
  const token = session;
  message.textContent = 'Opening this section…';
  message.hidden = false;
  Promise.all(missing.map(loadChunkFor)).then(() => {
    if (session !== token) return;
    paging = false;
    message.hidden = true;
    updateReaderButtons();
    action();
  }).catch(() => {
    if (session !== token) return;
    paging = false;
    updateReaderButtons();
    message.innerHTML = `This section couldn’t load. <button type="button" id="retryEdition">Try again</button>${activeBook.download ? ` or <a href="${esc(activeBook.download)}" download="${esc(downloadName(activeBook))}">download the EPUB</a>.` : '.'}`;
    $('retryEdition').addEventListener('click', () => withSpread(index, action));
  });
}

function bookCover(book) {
  if (book.cover) return `<div class="page-sheet reader-cover has-edition-art" style="--leather-bg:${book.leather.bg}">${coverImage(book)}</div>`;
  return `<div class="page-sheet reader-cover" style="--leather-bg:${book.leather.bg}">
    <div class="cover-gold-filigree"></div><div class="cover-header-tag">THE CASTLE LIBRARY · TOME ${book.no}</div>
    <div class="cover-heraldic-motif">${getMotifSVG(book.motif)}</div>
    <div><h2 class="cover-book-title">${esc(book.title)}</h2><p class="cover-book-author">${esc(book.author)}</p></div>
    <div class="cover-footer-meta"><span>${esc(ACCESS[book.access][0])}</span><span>${esc(book.year)}</span></div>
  </div>`;
}

function estatePage(book) {
  const source = '';
  const status = book.gutenberg ? (book.access === 'lectern' ? 'Free to read in the Castle Library. Text repaginated for the lectern.' : 'This title is in the catalog. Online reading is not available for this edition.') : book.access === 'listed' ? 'This title is in the catalog, but there is no full edition to read or download on Castle Library yet.' : book.rightsNote || 'Text edition, reformatted for Castle Library.';
  const license = book.licenseUrl && book.license ? `<p>License: <a class="edition-source" href="${esc(book.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(book.license)}</a></p>` : '';
  return `<div class="page-sheet title-page-sheet reader-title-sheet">
    <div class="tp-woodcut-frame" aria-hidden="true">✦ ⚜ ✦</div>
    <div><h2 class="tp-title">${esc(book.title)}</h2><p class="tp-author">${esc(book.author)}</p>${book.translator ? `<p>Translated by ${esc(book.translator)}</p>` : ''}</div>
    <div class="edition-copy"><p>${esc(book.tagline || '')}</p><p>${esc(status)}</p>${book.gutenberg ? `<p>Catalog no. ${book.no}</p>` : ""}${book.coverCredit ? `<p class="edition-credit">${esc(book.coverCredit)}</p>` : ''}${license}</div>
  </div>`;
}

function pageHTML(index) {
  if (index === -2) return bookCover(activeBook);
  if (index === -1) return `<div class="page-sheet marbled-endpaper-sheet"><div class="exlibris-plate-inner"><div class="exlibris-header">EX LIBRIS</div><div class="exlibris-signet">⚜</div><div class="exlibris-owner">${esc(studyOwnerName)}</div></div></div>`;
  if (index === 0) return estatePage(activeBook);
  if (index === readingPages.length + 1) return '<div class="page-sheet title-page-sheet end-of-book"><span>❦</span><p>End of the book</p></div>';
  const content = readingPages[index - 1];
  if (!content) return index > 0 && index <= readingPages.length
    ? `<div class="page-sheet text-sheet" data-page-placeholder="${index}"></div>`
    : '<div class="page-sheet marbled-endpaper-sheet"></div>';
  return `<div class="page-sheet text-sheet" data-page="${index}"><div class="reading-kicker">${esc(activeBook.title)}</div><div class="reading-text" tabindex="0" aria-label="Page ${index}">${content.map(([kind, text]) => kind === 'heading' ? `<h3>${markedHTML(text, index)}</h3>` : `<p>${markedHTML(text, index)}</p>`).join('')}</div><div class="page-folio">${index}</div></div>`;
}

function buildPairs() {
  if (!readingPages.length) {
    pairs = [[-2, -1], [0, null]];
    return;
  }
  // The inside front cover and page one face each other. Each successive leaf
  // carries a recto and verso; its reverse becomes the next left-hand page.
  pairs = [[-2, 0]];
  const content = Array.from({length: readingPages.length + 1}, (_, i) => i + 1);
  for (let i = 0; i < content.length; i += 2) pairs.push([content[i], content[i + 1] ?? null]);
  if (content.length % 2 === 0) pairs.push([null, null]);
}

function createLeaf(index) {
  const leaf = document.createElement('div');
  leaf.className = `book-leaf${index === 0 ? ' is-cover-leaf' : ''}`;
  const [front, back] = pairs[index];
  leaf.innerHTML = `<div class="leaf-face face-front">${pageHTML(front)}</div><div class="leaf-face face-back">${pageHTML(back)}</div>`;
  if (index < currentLeaf) leaf.classList.add('turned');
  leaf.addEventListener('click', e => {
    if (e.target.closest('button,input,a,.reading-text') || window.getSelection()?.toString()) return;
    flip(index < currentLeaf ? -1 : 1);
  });
  $('book3d').appendChild(leaf);
  leaves.set(index, leaf);
  return leaf;
}

function syncLeaves() {
  const expected = new Set([currentLeaf - 2, currentLeaf - 1, currentLeaf, currentLeaf + 1].filter(i => i >= 0 && i < pairs.length));
  for (const [i, leaf] of leaves) if (!expected.has(i)) { leaf.remove(); leaves.delete(i); }
  for (const i of expected) {
    const leaf = leaves.get(i) || createLeaf(i);
    const frontVisible = i === currentLeaf;
    const backVisible = i === currentLeaf - 1;
    leaf.style.zIndex = frontVisible || backVisible ? 8 : 5;
    leaf.children[0].inert = !frontVisible;
    leaf.children[1].inert = !backVisible;
  }
  prefetchNextSpread();
}

function visibleFolios() { return foliosAt(currentLeaf); }

function updateReaderButtons() {
  const busy = paging || turning;
  $('btnPagePrev').disabled = busy || currentLeaf === 0;
  $('btnPageNext').disabled = busy || currentLeaf >= pairs.length - 1;
  $('zonePrev').disabled = busy;
  $('zoneNext').disabled = busy;
}

function readerMeta() {
  const visible = visibleFolios();
  const end = pairs[currentLeaf]?.[0] === readingPages.length + 1 || pairs[currentLeaf - 1]?.[1] === readingPages.length + 1;
  $('bookPerspectiveRig').classList.toggle('is-closed', currentLeaf === 0);
  $('bookPerspectiveRig').classList.toggle('is-open', currentLeaf > 0);
  $('bookPerspectiveRig').classList.toggle('is-turning', turning);
  $('spreadLabel').textContent = currentLeaf === 0 ? 'FRONT COVER' : visible.length ? `${visible.length > 1 ? 'PAGES' : 'PAGE'} ${visible.join('–')} OF ${readingPages.length}` : end ? 'END OF BOOK' : activeBook.access === 'lectern' ? 'TITLE & EDITION' : 'CATALOG RECORD';
  $('folioForm').hidden = !readingPages.length;
  $('folioInput').max = readingPages.length;
  $('folioInput').placeholder = visible[0] || '1';
  if (document.activeElement !== $('folioInput')) $('folioInput').value = '';
  updateReaderButtons();
  $('zonePrev').hidden = currentLeaf === 0;
  $('zoneNext').hidden = currentLeaf === 0 || currentLeaf >= pairs.length - 1;
  $('savePlaceBtn').hidden = !readingPages.length;
}

function prepareBook() {
  const container = $('book3d');
  container.innerHTML = '<div class="book-ground-shadow" aria-hidden="true"></div><div class="book-backcover" aria-hidden="true"><i></i><i></i></div>';
  container.style.setProperty('--leather-bg', activeBook.leather.bg);
  container.style.setProperty('--leather-gold', activeBook.leather.gold);
  leaves.clear();
  buildPairs();
  syncLeaves();
  readerMeta();
}

function jumpToPage(page, save = true) {
  if (!Number.isInteger(page) || page < 1 || page > readingPages.length) return;
  const index = pairs.findIndex(pair => pair.includes(page));
  if (index < 0) return;
  const target = index + Number(pairs[index][1] === page);
  withSpread(target, () => {
    currentLeaf = target;
    if (save) savePosition(activeBook, page);
    prepareBook();
  });
}

function flip(step) {
  const next = currentLeaf + step;
  if (next < 0 || next >= pairs.length) return;
  withSpread(next, () => turnPreparedLeaf(step, next));
}

function turnPreparedLeaf(step, next) {
  initAudio();
  const leaf = leaves.get(step > 0 ? currentLeaf : next);
  if (!leaf) return;
  const token = session;
  turning = true;
  playPageFlipSound();
  const direction = step > 0 ? 'turning-forward' : 'turning-backward';
  leaf.style.zIndex = 14;
  leaf.classList.add('turning', direction);
  leaf.classList.toggle('turned', step > 0);
  $('bookPerspectiveRig').dataset.turn = step > 0 ? 'forward' : 'backward';
  currentLeaf = next;
  const folios = visibleFolios();
  if (folios.length && !(step > 0 && next === 1)) savePosition(activeBook, folios[0]);
  readerMeta();
  let timer;
  const settle = e => {
    if (e && (e.target !== leaf || !e.animationName.startsWith('book-'))) return;
    leaf.removeEventListener('animationend', settle);
    clearTimeout(timer);
    if (session !== token) return;
    leaf.classList.remove('turning', direction);
    turning = false;
    $('bookPerspectiveRig').removeAttribute('data-turn');
    syncLeaves();
    readerMeta();
  };
  leaf.addEventListener('animationend', settle);
  timer = setTimeout(settle, reducedMotion.matches ? 20 : 850);
}

async function loadGutenbergOnLectern(book, token) {
  const message = $('readerMessage');
  const parent = readingAbort.signal;
  const request = new AbortController();
  const cancel = () => request.abort();
  parent.addEventListener('abort',cancel,{once:true});
  const timeout = setTimeout(cancel,150000);
  message.hidden = false;
  message.textContent = 'Loading this edition into the Castle Library reader…';
  try {
    const pages = await archiveJson(book.chapterManifest,{signal:request.signal});
    if (!Number.isSafeInteger(pages.pageCount) || pages.pageCount < 1 || pages.pageCount > 100000 ||
      !Number.isSafeInteger(pages.pageChunkSize) || !Array.isArray(pages.startPages) || !pages.startPages[0]?.length) {
      throw Error('This edition did not return readable pages.');
    }
    // Let an in-progress cover animation finish before placing text on the lectern.
    while (token === session && turning) await new Promise(resolve=>setTimeout(resolve,40));
    if (token !== session || parent.aborted) return;
    activeBook = {...book,...pages};
    byId[book.id] = book;
    readingPages = new Array(pages.pageCount);
    pages.startPages.forEach((page,i)=>{ readingPages[i] = page; });
    message.hidden = true;
    prepareBook();
    const saved = Number(positions[book.id]);
    if (currentLeaf === 1 && saved > 1 && saved <= readingPages.length) jumpToPage(saved,false);
  } catch (error) {
    if (token !== session || parent.aborted) return;
    const text = error.name === 'AbortError' ? 'The edition took too long to load. Please try again.' : error.message;
    const retry = Object.assign(document.createElement('button'),{type:'button',textContent:'Try again here'});
    retry.onclick = () => loadGutenbergOnLectern(book,token);
    message.replaceChildren(`${text} `,retry);
    message.hidden = false;
  } finally {
    clearTimeout(timeout);
    parent.removeEventListener('abort',cancel);
  }
}

function openLecternBook(book) {
  const token = ++session;
  clearTimeout(openedFromCover);
  clearTimeout(resumeTask);
  readingAbort?.abort();
  readingAbort = new AbortController();
  chunkLoads = new Map();
  activeBook = book;
  ready = false;
  turning = false;
  paging = false;
  currentLeaf = 0;
  $('bookPerspectiveRig').removeAttribute('data-turn');
  readingPages = new Array(book.pageCount || 0);
  (book.startPages || []).forEach((page, i) => { readingPages[i] = page; });
  returnFocus = document.activeElement;
  const modal = $('lecternModal');
  initAudio();
  $('lecternTitleDisplay').textContent = book.title;
  $('lecternAuthorDisplay').textContent = `BY ${book.author.toUpperCase()}`;
  $('lecternStudyLabel').textContent = studyList.includes(book.id) ? 'IN STUDY ✓' : 'ADD TO STUDY';
  const download = $('lecternDownload');
  download.hidden = !book.download;
  if (book.download) { download.href = book.download; download.download = downloadName(book); }
  else download.removeAttribute('href');
  $('readerMessage').hidden = true;
  modal.hidden = false;
  document.body.classList.add('lock-scroll', 'reading-open');
  ready = true;
  prepareBook();
  requestAnimationFrame(() => {
    if (session !== token) return;
    modal.classList.add('visible');
    $('lecternCloseBtn').focus({preventScroll:true});
    playBookThudSound();
  });
  openedFromCover = setTimeout(() => {
    if (session !== token || currentLeaf !== 0) return;
    const saved = Number(positions[book.id]);
    flip(1);
    if (saved > 1 && saved <= readingPages.length) {
      resumeTask = setTimeout(() => {
        if (session === token && currentLeaf === 1) jumpToPage(saved, false);
      }, reducedMotion.matches ? 30 : 870);
    }
  }, reducedMotion.matches ? 25 : 240);
  if (book.chapterManifest && !book.pageCount) loadGutenbergOnLectern(book,token);
}

function closeLecternBook() {
  const modal = $('lecternModal');
  const token = ++session;
  clearTimeout(openedFromCover);
  clearTimeout(resumeTask);
  readingAbort?.abort();
  ready = false;
  paging = false;
  playBookThudSound();
  modal.classList.remove('visible');
  setTimeout(() => {
    if (token !== session) return;
    modal.hidden = true;
    document.body.classList.remove('lock-scroll', 'reading-open');
    $('book3d').replaceChildren();
    leaves.clear();
    pairs = [];
    readingPages = [];
    activeBook = null;
    if (returnFocus?.isConnected && !returnFocus.closest('[hidden]')) returnFocus.focus({preventScroll:true});
  }, reducedMotion.matches ? 0 : 235);
}

function initLecternControls() {
  const modal = $('lecternModal');
  $('lecternCloseBtn').addEventListener('click', closeLecternBook);
  $('lecternDownload').addEventListener('click', e => { if (activeBook?.gutenberg) downloadGutenberg(e, activeBook); });
  for (const [id, step] of [['btnPagePrev',-1],['zonePrev',-1],['btnPageNext',1],['zoneNext',1]]) $(id).addEventListener('click', () => flip(step));
  $('folioForm').addEventListener('submit', e => { e.preventDefault(); jumpToPage(Number($('folioInput').value)); });
  $('savePlaceBtn').addEventListener('click', () => {
    const page = visibleFolios()[0];
    if (!page) return;
    savePosition(activeBook, page);
    readerMeta();
    showToast(`Page ${page} saved in this browser.`);
  });
  $('lecternSoundBtn').addEventListener('click', togglePageSound);
  $('lecternStudyBtn').addEventListener('click', () => {
    if (!activeBook) return;
    toggleSaveBook(activeBook.id);
    $('lecternStudyLabel').textContent = studyList.includes(activeBook.id) ? 'IN STUDY ✓' : 'ADD TO STUDY';
  });
  // Horizontal swipes turn a physical leaf without blocking vertical text scrolling.
  const rig = $('bookPerspectiveRig');
  let gesture = null;
  rig.addEventListener('touchstart', e => {
    gesture = e.touches.length === 1 && !e.target.closest('button, a')
      ? {x:e.touches[0].clientX, y:e.touches[0].clientY, time:performance.now()} : null;
  }, {passive:true});
  rig.addEventListener('touchcancel', () => { gesture = null; });
  rig.addEventListener('touchend', e => {
    if (!gesture || e.touches.length || !e.changedTouches.length) { gesture = null; return; }
    const {clientX, clientY} = e.changedTouches[0];
    const dx = clientX - gesture.x, dy = clientY - gesture.y;
    const turn = Math.abs(dx) > 38 && Math.abs(dx) > 1.5 * Math.abs(dy) && performance.now() - gesture.time < 850;
    gesture = null;
    if (turn) { if (e.cancelable) e.preventDefault(); flip(dx < 0 ? 1 : -1); }
  }, {passive:false});
  window.addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeLecternBook(); return; }
    if (e.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button:not(:disabled), input, a[href], [tabindex="0"]')].filter(el => !el.closest('[hidden],[inert]') && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      return;
    }
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); flip(e.key === 'ArrowRight' ? 1 : -1); }
  });
}

/* ============================================================
   9. PRIVATE STUDY SHELF (EX LIBRIS)
   ============================================================ */
let studyList = [];
let studyOwnerName = 'Scholasticus';

function loadStudyData() {
  try {
    studyList = JSON.parse(localStorage.getItem('castle_library_study') || '[]');
    const pgSaved = JSON.parse(localStorage.getItem('castle_gutenberg_study') || '[]');
    for (const item of pgSaved) if (item?.gutenberg && /^pg-\d+$/.test(item.id)) byId[item.id] = item;
    studyOwnerName = localStorage.getItem('castle_library_owner') || 'Scholasticus';
  } catch (e) {
    studyList = [];
    studyOwnerName = 'Scholasticus';
  }
}

function saveStudyData() {
  try {
    localStorage.setItem('castle_library_study', JSON.stringify(studyList));
    localStorage.setItem('castle_library_owner', studyOwnerName);
    localStorage.setItem('castle_gutenberg_study',JSON.stringify(studyList.map(id => byId[id]).filter(book => book?.gutenberg)));
  } catch (e) {}
}

function toggleSaveBook(id) {
  initAudio();
  const index = studyList.indexOf(id);
  const book = byId[id];
  if (index >= 0) {
    studyList.splice(index, 1);
    showToast(`Removed “${esc(book.title)}” from your Study Shelf.`);
  } else {
    studyList.push(id);
    showToast(`Inscribed “${esc(book.title)}” into your Study Shelf.`);
  }
  saveStudyData();
  updateStudyBadge();
  renderStudyDrawer();
  const button = document.querySelector(`.accession-card[data-id="${id}"] .card-save-btn`);
  if (button) {
    button.textContent = studyList.includes(id) ? 'IN STUDY ✓' : '+ TO STUDY';
    button.setAttribute('aria-pressed', studyList.includes(id));
  }
}

function updateStudyBadge() {
  const badge = document.getElementById('studyBadge');
  if (badge) badge.textContent = studyList.length;
}

function renderStudyDrawer() {
  const listEl = document.getElementById('drawerBookList');
  const countEl = document.getElementById('drawerCountInfo');
  const ownerEl = document.getElementById('bookplateOwner');
  if (!listEl) return;

  if (ownerEl) ownerEl.textContent = studyOwnerName;
  if (countEl) countEl.textContent = `${studyList.length} Volumes Preserved in Study`;

  listEl.innerHTML = '';
  if (studyList.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:30px 10px;color:#9d8e7d;font-family:var(--font-serif);font-size:12.5px;">
        <span style="font-size:24px;color:var(--gold-leaf);display:block;margin-bottom:8px;">📜</span>
        Your study desk is currently empty.<br>Pull any tome from the Grand Shelf to preserve it here.
      </div>
    `;
    return;
  }

  studyList.forEach(id => {
    const book = byId[id];
    if (!book) return;
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = `
      <div>
        <div class="drawer-item-title">${esc(book.title)}</div>
        <div class="drawer-item-author">${esc(book.author)} · Tome ${book.no}</div>
      </div>
      <div class="drawer-item-actions">
        <button class="drawer-open-btn" title="Open on Lectern">${book.access === 'lectern' ? 'READ' : 'VIEW'}</button>
        <button class="drawer-remove-btn" title="Remove from Study">✕</button>
      </div>
    `;

    item.querySelector('.drawer-open-btn').addEventListener('click', () => {
      closeStudyDrawer();
      openCatalogBook(book);
    });

    item.querySelector('.drawer-remove-btn').addEventListener('click', () => {
      toggleSaveBook(book.id);
    });

    listEl.appendChild(item);
  });
}

function openStudyDrawer() {
  const drawer = document.getElementById('studyDrawer');
  const scrim = document.getElementById('studyScrim');
  if (!drawer || !scrim) return;
  renderStudyDrawer();
  scrim.hidden = false;
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('open'));
}

function closeStudyDrawer() {
  const drawer = document.getElementById('studyDrawer');
  const scrim = document.getElementById('studyScrim');
  if (!drawer || !scrim) return;
  drawer.classList.remove('open');
  setTimeout(() => {
    drawer.hidden = true;
    scrim.hidden = true;
  }, 400);
}

function initStudyDrawer() {
  const studyBtn = document.getElementById('studyBtn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const scrim = document.getElementById('studyScrim');
  const editOwnerBtn = document.getElementById('editOwnerBtn');

  if (studyBtn) studyBtn.addEventListener('click', openStudyDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeStudyDrawer);
  if (scrim) scrim.addEventListener('click', closeStudyDrawer);

  if (editOwnerBtn) {
    editOwnerBtn.addEventListener('click', () => {
      const newName = prompt('Inscribe your scholar’s name for the Ex Libris seal:', studyOwnerName);
      if (newName && newName.trim()) {
        studyOwnerName = newName.trim();
        saveStudyData();
        renderStudyDrawer();
        const lecternName = document.getElementById('lecternExLibrisName');
        if (lecternName) lecternName.textContent = studyOwnerName;
        showToast(`Ex Libris inscribed for: ${studyOwnerName}`);
      }
    });
  }
}

/* ============================================================
   10. TOAST NOTIFICATIONS & UTILITIES
   ============================================================ */
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('castleToast');
  const text = document.getElementById('toastText');
  if (!toast || !text) return;
  text.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => { toast.hidden = true; }, 400);
  }, 2800);
}

// Nav solid on scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('topNav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ============================================================
   INITIALIZATION ON DOM LOAD
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadStudyData();
  updateStudyBadge();
  initDustCanvas();
  initAtmosphereControls();
  renderShelfBooks();
  initShelfInteractions();
  renderVaultGrid();
  initVaultFilters();
  initLecternControls();
  initStudyDrawer();

  // Global first touch listener to unlock Web Audio context
  window.addEventListener('pointerdown', () => { initAudio(); }, { once: true });
});

/* ============================================================
   HIGHLIGHTS: select text in the lectern, keep it per book in this browser
   ============================================================ */
const HIGHLIGHT_KEY = 'castle_highlights';
const MAX_HIGHLIGHT = 600;
let highlightTarget = null;

function loadHighlights() {
  try { return JSON.parse(localStorage.getItem(HIGHLIGHT_KEY) || '{}') || {}; } catch { return {}; }
}
function bookHighlights(id) { return loadHighlights()[id] || []; }
function writeHighlights(data) {
  try { localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(data)); return true; }
  catch { showToast('Highlights could not be saved in this browser.'); return false; }
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function markedHTML(text, page) {
  const marks = bookHighlights(activeBook?.id).filter(h => h.p === page);
  const ranges = [];
  for (const mark of marks) {
    const words = mark.t.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const pattern = new RegExp(words.map(escapeRegExp).join('\\s+'), 'g');
    let found;
    while ((found = pattern.exec(text))) {
      ranges.push([found.index, found.index + found[0].length]);
      if (found[0].length === 0) pattern.lastIndex++;
    }
  }
  if (!ranges.length) return esc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end); else merged.push([start, end]);
  }
  let html = '', cursor = 0;
  for (const [start, end] of merged) {
    html += esc(text.slice(cursor, start));
    html += `<mark class="hl" data-page="${page}">${esc(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  return html + esc(text.slice(cursor));
}

function refreshTextFaces() {
  for (const leaf of leaves.values()) {
    for (const face of leaf.children) {
      const sheet = face.querySelector('[data-page]');
      const folio = Number(sheet?.dataset.page);
      if (folio && readingPages[folio - 1]) face.innerHTML = pageHTML(folio);
    }
  }
}

function addHighlight(page, text) {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, MAX_HIGHLIGHT);
  if (clean.length < 2 || !activeBook) return false;
  const all = loadHighlights();
  const list = all[activeBook.id] || [];
  if (!list.some(h => h.p === page && h.t === clean)) list.push({ p: page, t: clean });
  all[activeBook.id] = list;
  if (!writeHighlights(all)) return false;
  refreshTextFaces();
  return true;
}

function removeHighlight(page, text) {
  if (!activeBook) return;
  const all = loadHighlights();
  all[activeBook.id] = (all[activeBook.id] || []).filter(h => !(h.p === page && h.t === text));
  writeHighlights(all);
  refreshTextFaces();
  renderHighlightPanel();
}

function hideHighlightPopover() {
  const pop = document.getElementById('hlPopover');
  if (pop) pop.hidden = true;
  highlightTarget = null;
}

function showHighlightPopover(rect, target) {
  const pop = document.getElementById('hlPopover');
  highlightTarget = target;
  pop.querySelector('button').textContent = target.remove ? 'Remove highlight' : 'Highlight';
  pop.hidden = false;
  const width = pop.offsetWidth || 140;
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2));
  pop.style.left = `${left}px`;
  pop.style.top = `${Math.max(8, rect.top - 46)}px`;
}

function renderHighlightPanel() {
  const panel = document.getElementById('hlPanel');
  if (!panel || !activeBook) return;
  const list = panel.querySelector('.hl-list');
  const items = bookHighlights(activeBook.id).slice().sort((a, b) => a.p - b.p);
  panel.querySelector('.hl-count').textContent = `${items.length} ${items.length === 1 ? 'highlight' : 'highlights'}`;
  list.replaceChildren();
  if (!items.length) {
    list.innerHTML = '<p class="hl-empty">Select any passage on a page and choose Highlight. Your highlights stay in this browser.</p>';
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'hl-row';
    row.innerHTML = `<button type="button" class="hl-go" aria-label="Go to page ${item.p}">p. ${item.p}</button><blockquote>${esc(item.t)}</blockquote><button type="button" class="hl-del" aria-label="Remove this highlight">Remove</button>`;
    row.querySelector('.hl-go').addEventListener('click', () => { panel.hidden = true; jumpToPage(item.p, true); });
    row.querySelector('.hl-del').addEventListener('click', () => removeHighlight(item.p, item.t));
    list.appendChild(row);
  }
}

function initHighlights() {
  const tools = document.querySelector('#lecternModal .lectern-tools');
  const study = document.getElementById('lecternStudyBtn');
  if (!tools || !study || document.getElementById('highlightsBtn')) return;
  const button = Object.assign(document.createElement('button'), { type: 'button', id: 'highlightsBtn', className: 'brass-tool-btn', title: 'View and manage highlights in this book' });
  button.setAttribute('aria-label', 'Show highlights in this book');
  button.innerHTML = '<span class="tool-icon" aria-hidden="true">▮</span><span class="tool-label">HIGHLIGHTS</span>';
  tools.insertBefore(button, study);

  const pop = document.createElement('div');
  pop.id = 'hlPopover';
  pop.className = 'hl-popover';
  pop.hidden = true;
  pop.innerHTML = '<button type="button">Highlight</button>';
  document.body.appendChild(pop);
  pop.querySelector('button').addEventListener('click', () => {
    if (!highlightTarget) return;
    if (highlightTarget.remove) removeHighlight(highlightTarget.page, highlightTarget.text);
    else {
      const ok = addHighlight(highlightTarget.page, highlightTarget.text);
      if (ok) showToast('Passage highlighted.');
      window.getSelection()?.removeAllRanges();
    }
    hideHighlightPopover();
  });

  const panel = document.createElement('section');
  panel.id = 'hlPanel';
  panel.className = 'hl-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Highlights in this book');
  panel.innerHTML = '<header><h3>Highlights</h3><span class="hl-count"></span><button type="button" class="hl-close" aria-label="Close highlights">✕</button></header><div class="hl-list"></div>';
  document.body.appendChild(panel);
  panel.querySelector('.hl-close').addEventListener('click', () => { panel.hidden = true; });
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { renderHighlightPanel(); panel.querySelector('.hl-close').focus(); }
  });

  // Create a highlight from a text selection on a page.
  document.addEventListener('pointerup', e => {
    if (document.getElementById('lecternModal').hidden) return;
    if (pop.contains(e.target)) return;
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (selection && !selection.isCollapsed && text.trim().length >= 2 && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      const sheet = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest('.text-sheet[data-page]');
      if (!sheet) return hideHighlightPopover();
      showHighlightPopover(range.getBoundingClientRect(), { page: Number(sheet.dataset.page), text: text.replace(/\s+/g, ' ').trim().slice(0, MAX_HIGHLIGHT), remove: false });
      return;
    }
    const mark = e.target.closest?.('mark.hl');
    if (mark) {
      const sheet = mark.closest('.text-sheet[data-page]');
      const page = Number(sheet?.dataset.page);
      showHighlightPopover(mark.getBoundingClientRect(), { page, text: mark.textContent.replace(/\s+/g, ' ').trim(), remove: true });
      return;
    }
    hideHighlightPopover();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { hideHighlightPopover(); e.stopPropagation(); } }, true);
}

document.addEventListener('DOMContentLoaded', initHighlights);
