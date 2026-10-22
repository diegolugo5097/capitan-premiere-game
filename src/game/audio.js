/* =========================================================
   AUDIO: efectos y música sintetizados con Web Audio.
   Cada canción es una tabla de patrones de 16 pasos por compás:
   batería, bajo, guitarra rítmica y melodía.
   ========================================================= */

// Melodías: 16 fichas por compás. Número = semitonos sobre la raíz,
// "." = silencio, "-" = sostener la nota anterior.
const SONGS = {
  // Pantalla de inicio: tema épico en Re menor (i - VII - VI - V).
  // La batería entra en el compás 5 para que el tema crezca.
  intro: {
    bpm: 116, root: 146.83, prog: [0, -2, -4, -5],
    drums: 'rock', drumsFrom: 4,
    lead: [
      '12 - - - 17 - 19 - 20 - 19 - 17 - - -',
      '19 - - - 17 - 15 - 14 - 15 - 17 - - -',
      '15 - - - 14 - 12 - 10 - 12 - 14 - - -',
      '19 - - - 23 - 26 - - - 23 - 19 - - -',
      '24 - 22 - 24 - 26 - 27 - - - 26 - 24 -',
      '22 - 19 - 22 - 26 - 24 - - - 22 - 19 -',
      '20 - 22 - 24 - 27 - 26 - 24 - 22 - 20 -',
      '19 - - - - - - - 23 - 26 - 31 - - -',
    ],
  },
  // Portada: tema heroico en Re mayor
  title: {
    bpm: 128, root: 146.83, prog: [0, 7, 9, 5],
    drums: 'rock',
    lead: [
      '12 - - 14 16 - 19 - 16 - 14 - 12 - - -',
      '19 - - 21 19 - 16 - 14 - 16 - 19 - - -',
      '21 - - 19 16 - 14 - 16 - 19 - 21 - - -',
      '24 - 23 - 21 - 19 - 16 - - - . . . .',
    ],
  },
  // Calle Real: rock de acción en La menor
  level: {
    bpm: 152, root: 110, prog: [0, 8, 10, 7],
    drums: 'drive',
    lead: [
      '12 . 12 15 . 17 . 19 - - 17 15 - 12 . .',
      '8 . 8 12 . 15 . 17 - - 15 12 - 8 . .',
      '10 . 10 14 . 17 . 19 - - 17 14 - 10 12 14',
      '19 - 17 - 14 - 12 - 10 - 12 - 14 - - -',
      '24 22 19 17 19 . 24 . 22 19 17 15 17 . 12 .',
      '20 19 15 12 15 . 20 . 19 15 12 10 12 . 8 .',
      '22 19 17 14 17 . 22 . 19 17 14 12 14 . 10 .',
      '19 . 19 . 22 . 19 . 26 - - - 24 - 22 -',
    ],
  },
  // Doctor Broca: metal rápido en Do menor armónica
  boss: {
    bpm: 172, root: 130.81, prog: [0, 8, 5, 7],
    drums: 'blast',
    lead: [
      '12 . 15 . 12 . 18 . 17 - 15 - 12 . 11 .',
      '8 . 12 . 8 . 15 . 14 - 12 - 8 . 7 .',
      '17 . 20 . 17 . 24 . 22 - 20 - 17 . 15 .',
      '19 . 23 . 26 . 23 . 19 - - - 23 - 26 -',
      '24 23 24 . 20 . 24 . 23 20 19 . 17 . 15 .',
      '20 19 20 . 15 . 20 . 19 15 12 . 15 . 17 .',
      '17 15 17 . 20 . 24 . 22 20 17 . 20 . 22 .',
      '23 - - - 26 - - - 31 - - - 30 - 29 -',
    ],
  },
  // Victoria: fanfarria
  win: {
    bpm: 140, root: 146.83, prog: [0, 5, 7, 0],
    drums: 'rock',
    lead: [
      '12 . 12 . 12 - 16 - 19 - - - 16 - 19 -',
      '17 - 21 - 24 - - - 21 - 17 - 21 - - -',
      '19 - 23 - 26 - - - 23 - 19 - 23 - - -',
      '24 - - - 19 - - - 24 - - - . . . .',
    ],
  },
};
const parsed = {};
for (const [k, s] of Object.entries(SONGS)) parsed[k] = s.lead.map(bar => bar.trim().split(/\s+/));

export function createAudio() {
  const A = { ctx: null, master: null, music: null, muted: false, step: 0, next: 0, mode: null, timer: null };
  try { A.muted = localStorage.getItem('cp-muted') === '1'; } catch (e) { /* sin almacenamiento */ }

  function init() {
    if (A.ctx) { if (A.ctx.state !== 'running') A.ctx.resume().catch(() => {}); return; }
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.5;
      const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      A.master.connect(comp); comp.connect(A.ctx.destination);
      A.music = A.ctx.createGain(); A.music.gain.value = 0.42; A.music.connect(A.master);
      A.noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate * 0.6, A.ctx.sampleRate);
      const d = A.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.timer = setInterval(tick, 25);
    } catch (e) { A.ctx = null; }
  }
  const now = () => (A.ctx ? A.ctx.currentTime : 0);

  /* Desbloqueo del audio en celulares.
     - iOS y Android solo permiten arrancar el audio dentro de un toque que
       termina (touchend / pointerup / click), no en pointerdown.
     - iOS además exige reproducir algo en ese mismo toque: un búfer silencioso.
     - En iPhone, audioSession = 'playback' hace que suene aunque el
       interruptor de silencio esté activado (iOS 17 en adelante).
     - Si el sistema suspende el audio (llamada, cambio de app), se reanuda
       en el siguiente toque o al volver a la pestaña. */
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* no soportado */ }
    init();
    if (!A.ctx) return;
    if (A.ctx.state !== 'running') A.ctx.resume().catch(() => {});
    try {
      const b = A.ctx.createBuffer(1, 1, 22050), src = A.ctx.createBufferSource();
      src.buffer = b; src.connect(A.ctx.destination); src.start(0);
    } catch (e) { /* ignorar */ }
  }
  const UNLOCK_EVENTS = ['touchend', 'pointerup', 'click', 'keydown'];
  const onGesture = () => { if (!A.ctx || A.ctx.state !== 'running') unlock(); };
  const onVisible = () => { if (document.visibilityState === 'visible' && A.ctx && A.ctx.state !== 'running') A.ctx.resume().catch(() => {}); };
  UNLOCK_EVENTS.forEach(ev => window.addEventListener(ev, onGesture, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', onVisible);

  function tone(f, dur, type = 'square', vol = 0.15, slide = 0, t0 = 0, dest, filter = 0, detune = 0) {
    if (!A.ctx) return;
    const t = t0 || A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (filter) { const fl = A.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; fl.Q.value = 4; o.connect(fl); node = fl; }
    node.connect(g); g.connect(dest || A.master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol = 0.2, freq = 2000, t0 = 0, dest, type = 'bandpass') {
    if (!A.ctx) return;
    const t = t0 || A.ctx.currentTime;
    const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = A.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || A.master); s.start(t); s.stop(t + dur + 0.03);
  }

  // batería
  const kick = t => { tone(160, 0.16, 'sine', 0.9, -120, t, A.music); noise(0.02, 0.25, 3000, t, A.music); };
  const snare = t => { noise(0.14, 0.42, 1900, t, A.music); tone(190, 0.08, 'triangle', 0.3, -40, t, A.music); };
  const hat = (t, open) => noise(open ? 0.14 : 0.035, open ? 0.12 : 0.09, 9000, t, A.music, 'highpass');
  const crash = t => noise(0.9, 0.18, 6000, t, A.music, 'highpass');
  const DRUMS = {
    rock: { k: [0, 8, 10], s: [4, 12], h: 2 },
    drive: { k: [0, 6, 8, 10], s: [4, 12], h: 1 },
    blast: { k: [0, 2, 4, 6, 8, 10, 12, 14], s: [4, 12], h: 1 },
  };

  function tick() {
    if (!A.ctx || !A.mode || A.muted || A.ctx.state !== 'running') { if (A.ctx) A.next = A.ctx.currentTime + 0.05; return; }
    const S = SONGS[A.mode], L = parsed[A.mode], sp = 60 / S.bpm / 4;
    while (A.next < A.ctx.currentTime + 0.12) {
      const t = A.next, s = A.step % 16, barN = Math.floor(A.step / 16), bar = barN % 4;
      const r = S.root * Math.pow(2, S.prog[bar] / 12);
      const D = DRUMS[S.drums];
      // batería con redoble al final de cada 4 compases
      const drumsOn = barN >= (S.drumsFrom || 0);
      const fill = bar === 3 && s >= 12 && (drumsOn || barN === (S.drumsFrom || 0) - 1);
      if (drumsOn && (D.k.includes(s) || (S.drums === 'blast' && bar === 3 && s % 2 === 1))) kick(t);
      if ((drumsOn && D.s.includes(s)) || (fill && s >= 13)) snare(t);
      if (drumsOn && s % D.h === 0 && !fill) hat(t, s === 14);
      if (!drumsOn && s === 0) tone(73.4 * Math.pow(2, S.prog[bar] / 12), sp * 15, 'triangle', 0.3, 0, t, A.music); // pedal grave
      if (s === 0 && barN % 8 === 0) crash(t);
      // bajo: corcheas con octava y nota de paso
      if (s % 2 === 0 && drumsOn) {
        const pat = [0, 0, 12, 0, 0, 12, 0, s === 14 && bar === 3 ? -1 : 10];
        tone(r / 2 * Math.pow(2, pat[s / 2] / 12), sp * 1.7, 'sawtooth', 0.32, 0, t, A.music, 700);
      }
      // guitarra rítmica: acordes de quinta palm-mute
      if (drumsOn ? [0, 3, 6, 8, 11, 14].includes(s) : s === 0 || s === 8) {
        for (const n of [0, 7, 12]) tone(r * Math.pow(2, n / 12), sp * 0.9, 'sawtooth', 0.045, 0, t, A.music, 1600, 6);
      }
      // melodía principal (doble oscilador)
      const line = L[barN % L.length], tok = line[s];
      if (tok !== '.' && tok !== '-') {
        let len = 1; while (s + len < 16 && line[s + len] === '-') len++;
        const f = S.root * 2 * Math.pow(2, Number(tok) / 12);
        tone(f, sp * len * 0.95, 'square', 0.07, 0, t, A.music, 3200);
        tone(f, sp * len * 0.95, 'sawtooth', 0.05, 0, t, A.music, 2600, 9);
      }
      A.step++; A.next += sp;
    }
  }

  const SFX = {
    whoosh: () => noise(0.07, 0.12, 3500),
    hit: () => { noise(0.09, 0.45, 1400); tone(140, 0.09, 'square', 0.22, -70); },
    heavy: () => { noise(0.16, 0.55, 700); tone(90, 0.18, 'square', 0.3, -50); },
    hurt: () => { tone(220, 0.16, 'sawtooth', 0.18, -140); noise(0.1, 0.3, 900); },
    jump: () => tone(260, 0.13, 'square', 0.1, 420),
    land: () => noise(0.05, 0.15, 500),
    pickup: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.09, 'square', 0.12, 0, now() + i * 0.06)); },
    coin: () => { tone(988, 0.07, 'square', 0.12); tone(1319, 0.2, 'square', 0.12, 0, now() + 0.07); },
    special: () => { tone(200, 0.5, 'sawtooth', 0.2, 900); noise(0.5, 0.25, 2500); },
    ko: () => tone(400, 0.5, 'square', 0.2, -350),
    blip: () => tone(700 + Math.random() * 120, 0.025, 'square', 0.035),
    throw: () => tone(500, 0.12, 'triangle', 0.12, -250),
    drill: () => { tone(85, 0.5, 'sawtooth', 0.16, 40); noise(0.5, 0.18, 2600); },
    dig: () => noise(0.35, 0.35, 300, 0, null, 'lowpass'),
    boss: () => { tone(70, 0.9, 'sawtooth', 0.35, -30); noise(0.8, 0.3, 300); },
    crash: () => { noise(0.25, 0.5, 900); tone(160, 0.2, 'triangle', 0.2, -100); },
    flame: () => { noise(0.5, 0.32, 900, 0, null, 'lowpass'); noise(0.35, 0.14, 2600); },
    stinger: () => { [0, 7, 12, 15, 19].forEach(n => tone(146.83 * Math.pow(2, n / 12), 1.4, 'sawtooth', 0.08, 0, 0, null, 2400, 7)); noise(1.2, 0.3, 5000, 0, null, 'highpass'); tone(73.4, 0.6, 'sine', 0.8, -30); },
    select: () => { tone(660, 0.06, 'square', 0.12); tone(990, 0.1, 'square', 0.12, 0, now() + 0.06); },
  };

  return {
    init,
    SFX,
    setMusic(m) { if (A.mode === m) return; A.mode = m; A.step = 0; if (A.ctx) A.next = A.ctx.currentTime + 0.05; },
    isMuted: () => A.muted,
    isRunning: () => !!A.ctx && A.ctx.state === 'running',
    setMuted(m) {
      A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.5;
      try { localStorage.setItem('cp-muted', m ? '1' : '0'); } catch (e) { /* sin almacenamiento */ }
    },
    unlock,
    destroy() {
      UNLOCK_EVENTS.forEach(ev => window.removeEventListener(ev, onGesture, { capture: true }));
      document.removeEventListener('visibilitychange', onVisible);
      if (A.timer) clearInterval(A.timer); if (A.ctx) A.ctx.close().catch(() => {}); A.ctx = null; },
  };
}
