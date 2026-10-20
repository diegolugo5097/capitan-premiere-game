/* =========================================================
   CAPITÁN PREMIERE vs EL DOCTOR BROCA — motor del juego.
   createGame(canvas, assets, hooks) arranca el juego en un <canvas>
   y devuelve controles para React (entrada táctil, sonido, pausa).
   ========================================================= */
import { LEVEL1 } from './content.js';
import { createAudio } from './audio.js';

export function createGame(canvas, assets, hooks = {}) {
  const cleanup = [];
  const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); cleanup.push(() => target.removeEventListener(ev, fn, opt)); };
  const HERO_META = assets.hero.meta, BROCA_META = assets.broca.meta, MINION_META = assets.minion.meta;
  const W = 960, H = 540, FLOOR_TOP = 340, FLOOR_BOT = 515, LEVEL_W = 4460;
  const cv = canvas;
  const ctx = cv.getContext('2d');
  cv.width = W; cv.height = H;

  const FONT_HUD = '"Press Start 2P", "Courier New", monospace';
  const FONT_TXT = '"VT323", "Courier New", monospace';
  const FONT_LOGO = '"Bungee", Impact, "Arial Black", sans-serif';

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sign = v => v < 0 ? -1 : 1;
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------------- ENTRADA (teclado + táctil) ---------------- */
  const IN = { held: {}, buf: {} };
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'punch', KeyZ: 'punch', KeyK: 'kick', KeyX: 'kick', Space: 'jump', KeyL: 'jump', KeyC: 'jump',
    KeyI: 'special', KeyV: 'special', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
  };
  function press(a) { if (!IN.held[a]) IN.buf[a] = 9; IN.held[a] = true; audioInit(); }
  function release(a) { IN.held[a] = false; }
  function consume(a) { if (IN.buf[a] > 0) { IN.buf[a] = 0; return true; } return false; }
  function confirmPressed() { return consume('start') | consume('punch') | consume('kick') | consume('jump'); }
  on(window, 'keydown', e => { const a = KEYMAP[e.code]; if (!a) return; e.preventDefault(); if (e.repeat) return; press(a); });
  on(window, 'keyup', e => { const a = KEYMAP[e.code]; if (a) release(a); });
  on(window, 'blur', () => { for (const k in IN.held) IN.held[k] = false; });

  /* ---------------- AUDIO ---------------- */
  const audio = createAudio();
  const SFX = audio.SFX, setMusic = audio.setMusic, audioInit = audio.init;
  function setMuted(m) { audio.setMuted(m); hooks.onMuteChange && hooks.onMuteChange(m); }

  /* ---------------- RECURSOS ---------------- */
  const IMG = {};
  function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
  // dibuja un frame de un atlas; las hojas miran a la derecha y el ancla es el pie
  function drawFrame(img, meta, anim, idx, sx, sy, face, scale = 1, alpha = 1, rot = 0) {
    const list = meta[anim]; if (!list) return; const fr = list[Math.min(idx, list.length - 1)];
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(sx), Math.round(sy));
    if (rot) ctx.rotate(rot);
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, fr[0], fr[1], fr[2], fr[3], -fr[4] * scale, -fr[5] * scale, fr[2] * scale, fr[3] * scale);
    ctx.restore();
  }
  const drawHero = (a, i, x, y, f, al) => drawFrame(IMG.hero, HERO_META, a, i, x, y, f, 1, al);
  function drawFace(expr, x, y, size) { ctx.drawImage(IMG.alf, (expr % 4) * 160, Math.floor(expr / 4) * 160, 160, 160, x, y, size, size); }
  // copias teñidas del atlas (sin ctx.filter, que Safari no soporta)
  function tinted(img, mul, add = [0, 0, 0]) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
    g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i + 3]) { p[i] = p[i] * mul[0] + add[0]; p[i + 1] = p[i + 1] * mul[1] + add[1]; p[i + 2] = p[i + 2] * mul[2] + add[2]; }
    g.putImageData(d, 0, 0); return c;
  }
  function whiteOf(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return c;
  }

  /* ---------------- FONDOS: CALLE COLONIAL ---------------- */
  const BG = {};
  const HOUSE_COLORS = [['#b8322a', '#8e221c'], ['#2e6fb7', '#20508a'], ['#2f8f4e', '#226b3a'], ['#e0a82a', '#b5841a'], ['#7b4fa0', '#5c3a7a'], ['#d8642c', '#a94a1d'], ['#1f8a8a', '#176868']];
  function buildBackgrounds() {
    const rnd = mulberry(57);
    // CIELO de la tarde
    const sky = document.createElement('canvas'); sky.width = 480; sky.height = 270; let g = sky.getContext('2d');
    let gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, '#3f8fd2'); gr.addColorStop(0.6, '#8fcbec'); gr.addColorStop(1, '#ffe2b5');
    g.fillStyle = gr; g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 7; i++) {
      const cx = rnd() * 480, cy = 14 + rnd() * 60, s = 0.6 + rnd() * 0.9;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx + (k - 3) * 9 * s, cy - Math.sin(k / 5 * Math.PI) * 7 * s, (7 + rnd() * 5) * s, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(180,200,225,0.5)'; g.fillRect(cx - 28 * s, cy + 3 * s, 56 * s, 3);
    }
    BG.sky = sky;
    // MONTAÑAS cafeteras, palmas de cera e iglesia
    const far = document.createElement('canvas'); far.width = 1400; far.height = 270; g = far.getContext('2d');
    const ridge = (base, amp, col, seed) => { const r2 = mulberry(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, 270); let y = base; for (let x = 0; x <= 1400; x += 10) { y = clamp(y + (r2() - 0.5) * amp, base - 40, base + 20); g.lineTo(x, y); } g.lineTo(1400, 270); g.fill(); };
    ridge(70, 14, '#8ab0b4', 3); ridge(95, 16, '#5f9a76', 7);
    g.strokeStyle = 'rgba(30,80,40,0.3)'; g.lineWidth = 1;
    for (let x = -200; x < 1400; x += 9) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x + 60, 100); g.stroke(); }
    ridge(118, 10, '#3f7d4f', 11);
    for (let i = 0; i < 26; i++) {
      const px = rnd() * 1400, base = 112 + rnd() * 20, h = 50 + rnd() * 40;
      g.fillStyle = '#d9d2c0'; g.fillRect(px, base - h, 2, h);
      g.fillStyle = '#2f6b3a'; for (let k = 0; k < 5; k++) { g.save(); g.translate(px + 1, base - h); g.rotate(-2.6 + k * 0.6); g.fillRect(0, -1, 9, 2); g.restore(); }
    }
    const cx = 760; g.fillStyle = '#f2ece0'; g.fillRect(cx, 92, 46, 40); g.fillRect(cx - 2, 70, 12, 62); g.fillRect(cx + 36, 70, 12, 62);
    g.fillStyle = '#b5552f'; g.beginPath(); g.moveTo(cx - 4, 70); g.lineTo(cx + 4, 58); g.lineTo(cx + 12, 70); g.fill(); g.beginPath(); g.moveTo(cx + 34, 70); g.lineTo(cx + 42, 58); g.lineTo(cx + 50, 70); g.fill();
    g.fillStyle = '#5a4030'; g.fillRect(cx + 18, 112, 10, 20);
    BG.far = far;
    // CALLE (media resolución, se escala x2)
    const near = document.createElement('canvas'); near.width = LEVEL_W / 2; near.height = 270; g = near.getContext('2d');
    g.fillStyle = '#b9aa94'; g.fillRect(0, 148, near.width, 24);
    for (let tx = 0; tx < near.width; tx += 14) { g.fillStyle = 'rgba(80,60,40,0.25)'; g.fillRect(tx, 148, 1, 24); }
    g.fillStyle = 'rgba(80,60,40,0.25)'; g.fillRect(0, 160, near.width, 1);
    g.fillStyle = '#8c7c66'; g.fillRect(0, 170, near.width, 5); g.fillStyle = '#d6c8b0'; g.fillRect(0, 170, near.width, 1);
    // empedrado
    g.fillStyle = '#4b4238'; g.fillRect(0, 175, near.width, 95);
    for (let sy = 176; sy < 270; sy += 7) {
      const off = ((sy / 7) | 0) % 2 ? 4 : 0;
      for (let sx = -off; sx < near.width; sx += 8 + (rnd() * 3 | 0)) {
        const tn = 118 + rnd() * 28 | 0, w = 6 + rnd() * 2, h = 5 + rnd();
        g.fillStyle = `rgb(${tn},${tn - 10},${tn - 25})`; g.beginPath(); g.ellipse(sx + w / 2, sy + h / 2, w / 2, h / 2, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx + 2, sy + 1, 2, 1);
      }
    }
    g.fillStyle = '#a99780'; for (let lx = 0; lx < near.width; lx += 16) g.fillRect(lx, 222, 14, 5);
    const houses = [
      { w: 200, st: 2, sign: 'TIENDA LA ESQUINA' }, { w: 160, st: 1 }, { w: 210, st: 2, sign: 'PANADERÍA' }, { w: 150, st: 1, sign: 'ARTESANÍAS' },
      { w: 220, st: 2 }, { w: 170, st: 1, sign: 'BILLARES EL PORVENIR' }, { w: 200, st: 2, sign: 'FONDA LA ARRIERA' }, { w: 160, st: 1 }, { w: 280, st: 2 },
    ];
    let x = 0, ci = 0;
    for (const h of houses) { drawHouse(g, x, h, HOUSE_COLORS[ci++ % HOUSE_COLORS.length], rnd); x += h.w; }
    drawPremiereHouse(g, 1750, 480, rnd);
    for (let lx = 110; lx < near.width - 60; lx += 240) {
      if (lx > 1720) continue;
      g.fillStyle = '#1d1a18'; g.fillRect(lx, 80, 3, 92); g.fillRect(lx - 3, 168, 9, 4);
      g.fillRect(lx - 4, 66, 11, 3); g.fillRect(lx - 3, 69, 9, 11); g.fillStyle = '#ffe7a3'; g.fillRect(lx - 1, 71, 5, 7); g.fillStyle = '#1d1a18'; g.fillRect(lx - 1, 62, 5, 4);
    }
    BG.near = near;
    const sl = document.createElement('canvas'); sl.width = 4; sl.height = 4; g = sl.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, 0, 4, 1); g.fillRect(0, 2, 4, 1);
    BG.scan = ctx.createPattern(sl, 'repeat');
  }
  function wallTex(g, x, y, w, h, rnd, base = '#f3eee2') {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    for (let i = 0; i < w * h / 70; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(160,140,110,0.10)' : 'rgba(255,255,255,0.25)'; g.fillRect(x + rnd() * w | 0, y + rnd() * h | 0, 2 + (rnd() * 3 | 0), 1); }
  }
  function roof(g, x, y, w) {
    g.fillStyle = '#7a2f1c'; g.fillRect(x - 4, y - 10, w + 8, 10);
    for (let ty = y - 10; ty < y; ty += 4) for (let tx = x - 4 + ((ty / 4) % 2 ? 3 : 0); tx < x + w + 4; tx += 6) { g.fillStyle = '#b3502f'; g.fillRect(tx, ty, 5, 3); g.fillStyle = '#d06a43'; g.fillRect(tx, ty, 5, 1); }
    g.fillStyle = '#4a2a18'; g.fillRect(x - 4, y, w + 8, 2);
    for (let c = x; c < x + w; c += 9) { g.fillStyle = '#5a3a24'; g.fillRect(c, y + 2, 3, 3); }
    const sh = g.createLinearGradient(0, y + 2, 0, y + 12); sh.addColorStop(0, 'rgba(60,40,20,0.35)'); sh.addColorStop(1, 'rgba(60,40,20,0)'); g.fillStyle = sh; g.fillRect(x, y + 2, w, 10);
  }
  function shutterWindow(g, x, y, w, h, col) {
    g.fillStyle = col[1]; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#2a1e18'; g.fillRect(x, y, w, h);
    g.fillStyle = '#1b1411'; for (let bx = x + 2; bx < x + w; bx += 3) g.fillRect(bx, y, 1, h);
    g.fillStyle = col[0]; g.fillRect(x - 6, y, 4, h); g.fillRect(x + w + 2, y, 4, h);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 6, y + h / 2 | 0, 4, 1); g.fillRect(x + w + 2, y + h / 2 | 0, 4, 1);
    g.fillStyle = '#d9cfbd'; g.fillRect(x - 4, y + h + 2, w + 8, 2);
  }
  function door(g, x, y, w, h, col) {
    g.fillStyle = col[1]; g.fillRect(x - 3, y - 3, w + 6, h + 3);
    g.fillStyle = '#6b3f22'; g.fillRect(x, y, w, h);
    g.fillStyle = '#58321a'; g.fillRect(x + w / 2 | 0, y, 1, h);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (const px of [x + 2, x + w / 2 + 2]) { g.fillRect(px | 0, y + 3, (w / 2 - 4) | 0, 1); g.fillRect(px | 0, y + h / 2 | 0, (w / 2 - 4) | 0, 1); }
    g.fillStyle = '#c9a227'; g.fillRect((x + w / 2 - 3) | 0, y + h / 2 | 0, 2, 2); g.fillRect((x + w / 2 + 2) | 0, y + h / 2 | 0, 2, 2);
  }
  function bougainvillea(g, x, y, n, rnd) {
    for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.25 ? '#2f7a3a' : rnd() < 0.5 ? '#d42a8a' : '#ee4fa6'; g.fillRect(x + (rnd() - 0.5) * 18 | 0, y + rnd() * 26 | 0, 2, 2); }
  }
  function balcony(g, x, y, w, col, rnd) {
    g.fillStyle = '#4a2a18'; g.fillRect(x - 2, y + 18, w + 4, 4);
    g.fillStyle = col[0]; g.fillRect(x - 2, y, w + 4, 2);
    for (let bx = x; bx < x + w; bx += 4) g.fillRect(bx, y + 2, 2, 16);
    g.fillStyle = col[1]; g.fillRect(x - 2, y + 9, w + 4, 1);
    for (let mx = x + 4; mx < x + w - 4; mx += 16) { g.fillStyle = '#b5552f'; g.fillRect(mx, y - 5, 6, 5); bougainvillea(g, mx + 3, y - 8, 14, rnd); }
    bougainvillea(g, x + w - 4, y + 18, 22, rnd);
  }
  function hangSign(g, x, y, txt, col) {
    g.font = `7px ${FONT_LOGO}`; const tw = g.measureText(txt).width + 10;
    g.fillStyle = '#4a2a18'; g.fillRect(x - tw / 2 - 1, y - 7, tw + 2, 14);
    g.fillStyle = '#f2e6c8'; g.fillRect(x - tw / 2, y - 6, tw, 12);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y + 1);
  }
  function drawHouse(g, x, h, col, rnd) {
    const w = h.w, top = h.st === 2 ? 28 + (rnd() * 8 | 0) : 70 + (rnd() * 8 | 0);
    wallTex(g, x, top, w, 150 - top, rnd);
    g.fillStyle = 'rgba(120,100,70,0.25)'; g.fillRect(x + w - 1, top, 1, 150 - top);
    roof(g, x, top, w);
    g.fillStyle = col[0]; g.fillRect(x, 128, w, 22); g.fillStyle = col[1]; g.fillRect(x, 127, w, 2);
    for (let i = 0; i < w / 6; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + rnd() * w | 0, 130 + rnd() * 18 | 0, 3, 1); }
    const dx = x + (w * 0.15 + rnd() * w * 0.5) | 0;
    door(g, dx, 104, 26, 46, col);
    g.fillStyle = '#1d1a18'; g.fillRect(dx + 30, 98, 4, 6); g.fillStyle = '#ffe7a3'; g.fillRect(dx + 31, 99, 2, 4);
    for (let wx = x + 14; wx < x + w - 30; wx += 52) if (wx + 22 < dx - 8 || wx > dx + 40) shutterWindow(g, wx, 104, 20, 24, col);
    if (h.sign) hangSign(g, dx + 13, 92, h.sign, col[1]);
    if (h.st === 2) {
      for (let wx = x + 18; wx < x + w - 28; wx += 46) {
        g.fillStyle = col[1]; g.fillRect(wx - 2, top + 16, 22, 40); g.fillStyle = '#3a2a20'; g.fillRect(wx, top + 18, 18, 38);
        g.fillStyle = col[0]; g.fillRect(wx, top + 18, 8, 38); g.fillRect(wx + 10, top + 18, 8, 38);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let ly = top + 22; ly < top + 54; ly += 4) { g.fillRect(wx + 1, ly, 6, 1); g.fillRect(wx + 11, ly, 6, 1); }
      }
      balcony(g, x + 10, top + 38, w - 20, col, rnd);
    } else bougainvillea(g, x + 6, top + 4, 40, rnd);
  }
  function drawPremiereHouse(g, x, w, rnd) {
    const col = ['#b8322a', '#8e221c'], top = 10;
    wallTex(g, x, top, w, 150 - top, rnd, '#f6f1e6');
    roof(g, x, top, w);
    g.fillStyle = col[0]; g.fillRect(x, 128, w, 22); g.fillStyle = '#e0b81c'; g.fillRect(x, 126, w, 3);
    for (const bx of [x + 30, x + w - 150]) {
      for (let k = 0; k < 2; k++) { const wx = bx + 12 + k * 60; g.fillStyle = col[1]; g.fillRect(wx - 2, 30, 30, 44); g.fillStyle = '#ffdca0'; g.fillRect(wx, 32, 26, 42); g.fillStyle = col[0]; g.fillRect(wx, 32, 6, 42); g.fillRect(wx + 20, 32, 6, 42); g.fillStyle = '#6b3f22'; g.fillRect(wx + 12, 32, 2, 42); }
      balcony(g, bx, 58, 120, col, rnd);
    }
    // portón abierto con la escalera al segundo piso
    const dx = x + w / 2 - 34;
    g.fillStyle = col[1]; g.fillRect(dx - 4, 104, 76, 46);
    g.fillStyle = '#ffcf7a'; g.fillRect(dx, 108, 68, 42);
    g.fillStyle = '#c8873e'; for (let s = 0; s < 7; s++) g.fillRect(dx + 26 + s * 6, 144 - s * 5, 8, 2);
    g.fillStyle = '#6b3f22'; g.fillRect(dx, 108, 10, 42); g.fillRect(dx + 58, 108, 10, 42);
    g.fillStyle = '#5a3a24'; g.fillRect(dx - 8, 100, 84, 5);
    // tablero "suba al 2° piso"
    g.fillStyle = '#4a2a18'; g.fillRect(dx - 52, 112, 36, 30); g.fillStyle = '#1f2a24'; g.fillRect(dx - 50, 114, 32, 24);
    g.fillStyle = '#f2ead8'; g.font = `5px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SUBA', dx - 34, 121); g.fillText('2° PISO', dx - 34, 130);
    g.fillStyle = '#4a2a18'; g.fillRect(dx - 42, 142, 2, 8); g.fillRect(dx - 28, 142, 2, 8);
    for (const fx of [dx - 14, dx + 80]) { g.fillStyle = '#1d1a18'; g.fillRect(fx, 98, 5, 8); g.fillStyle = '#ffe7a3'; g.fillRect(fx + 1, 99, 3, 6); }
    bougainvillea(g, x + 8, 40, 60, rnd); bougainvillea(g, x + w - 10, 40, 60, rnd);
  }

  /* ---------------- ESTADO DEL JUEGO ---------------- */
  const G = { mode: 'loading', t: 0, camX: 0, shake: 0, hitstop: 0, ents: [], fx: [], score: 0, lives: 3, lock: null, toast: null, dialog: null, bossOn: false, banner: null };
  let P = null;
  let attackTokens = 0;

  function newPlayer() {
    return { kind: 'player', x: 160, y: 430, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, maxhp: 100, meter: 40, st: 'idle', t: 0, fi: 0, atk: null, combo: 0, comboT: 0, invuln: 90, hitSet: null, queued: false };
  }
  function resetLevel() {
    G.ents = []; G.fx = []; G.camX = 0; G.lock = null; G.bossOn = false; G.toast = null; G.banner = { text: LEVEL1.name, t: 150 };
    G.score = 0; G.lives = 3; P = newPlayer(); G.ents.push(P);
    for (const [x, y, look, drop] of LEVEL1.props) G.ents.push({ kind: 'prop', look, x, y, z: 0, hp: 1, drop, t: 0, face: 1 });
    G.nextWave = 0; G.bossDone = false; attackTokens = 0; G.boss = null; G.go = 0;
  }
  function continueFromCheckpoint() {
    G.lives = 3; P.hp = P.maxhp; P.st = 'idle'; P.invuln = 150; P.z = 0; P.meter = Math.max(P.meter, 50);
    P.x = G.camX + 200; P.y = 430;
    for (const e of G.ents) if (e.kind === 'enemy' && e.st === 'cheer') { e.st = 'think'; e.t = 0; }
    G.mode = 'play'; setMusic(G.bossOn ? 'boss' : 'level');
  }

  /* ---------------- DIÁLOGOS ---------------- */
  function openDialog(lines, onEnd) { G.dialog = { lines, i: 0, chars: 0, onEnd }; G.prevMode = G.mode; G.mode = 'dialog'; }
  function updDialog() {
    const D = G.dialog, line = D.lines[D.i][1];
    if (D.chars < line.length) { D.chars += 0.9; if ((G.t & 3) === 0) SFX.blip(); if (confirmPressed()) D.chars = line.length; return; }
    if (confirmPressed()) {
      SFX.select(); D.i++; D.chars = 0;
      if (D.i >= D.lines.length) { G.dialog = null; G.mode = G.prevMode === 'dialog' ? 'play' : G.prevMode; D.onEnd && D.onEnd(); }
    }
  }
  function toast(line) { G.toast = { expr: line[0], text: line[1], t: 260 }; }

  /* ---------------- JUGADOR ---------------- */
  const ATK = {
    jab1: { seq: [['punch', 3, 3], ['punch', 0, 4], ['punch', 1, 4], ['punch', 4, 4]], act: [1, 2], reach: 92, dmg: 6, kb: 2.5 },
    jab2: { seq: [['punch', 4, 3], ['punch', 2, 4], ['punch', 0, 4], ['punch', 3, 5]], act: [1, 2], reach: 92, dmg: 7, kb: 3 },
    fin: { seq: [['kick', 0, 4], ['kick', 1, 4], ['kick', 2, 5], ['kick', 3, 5], ['kick', 5, 7]], act: [2, 3], reach: 112, dmg: 13, kb: 6, kd: true, heavy: true },
    kick: { seq: [['kick', 0, 4], ['kick', 3, 4], ['kick', 4, 6], ['kick', 5, 6]], act: [1, 2], reach: 112, dmg: 10, kb: 7 },
    low: { seq: [['crouch', 0, 3], ['crouch', 1, 4], ['crouch', 2, 5], ['crouch', 0, 4]], act: [1, 2], reach: 98, dmg: 7, kb: 2.5 },
    sweep: { seq: [['crouch', 0, 4], ['crouch', 3, 10], ['crouch', 0, 6]], act: [1], reach: 112, dmg: 9, kb: 4, kd: true, heavy: true },
    special: { seq: [['special', 0, 5], ['special', 1, 5], ['special', 2, 6], ['special', 3, 6], ['special', 4, 8]], act: [1, 2, 3], radius: 165, dmg: 12, kb: 7, kd: true, multi: true, heavy: true },
  };
  function startAttack(name) {
    P.st = 'attack'; P.atk = name; P.fi = 0; P.t = 0; P.hitSet = new Set(); P.queued = false; P.vx = 0; P.vy = 0;
    if (name === 'special') { P.meter = 0; P.invuln = Math.max(P.invuln, 34); SFX.special(); G.shake = 8; spawnRing(P.x, P.y - 60); }
    else SFX.whoosh();
  }
  function updPlayer() {
    const ix = (IN.held.right ? 1 : 0) - (IN.held.left ? 1 : 0), iy = (IN.held.down ? 1 : 0) - (IN.held.up ? 1 : 0);
    if (P.invuln > 0) P.invuln--;
    if (P.comboT > 0) P.comboT--; else P.combo = 0;
    const specialReq = consume('special') || (IN.buf.punch > 0 && IN.buf.kick > 0);
    switch (P.st) {
      case 'idle': case 'walk': {
        P.vx = ix * 3.6; P.vy = iy * 2.5; P.x += P.vx; P.y += P.vy;
        if (ix) P.face = ix;
        P.st = (ix || iy) ? 'walk' : 'idle'; P.t++;
        if (specialReq && P.meter >= 100) { IN.buf.punch = IN.buf.kick = 0; startAttack('special'); break; }
        if (consume('jump')) { P.st = 'jump'; P.vz = 12; P.vx = ix * 4; P.vy = iy * 1.6; P.t = 0; P.airAtk = false; SFX.jump(); break; }
        if (consume('punch')) { if (IN.held.down && !IN.held.up && !ix) startAttack('low'); else startAttack(P.combo >= 2 ? 'fin' : P.combo === 1 ? 'jab2' : 'jab1'); break; }
        if (consume('kick')) { startAttack(IN.held.down && !ix ? 'sweep' : 'kick'); break; }
        break;
      }
      case 'jump': {
        P.x += P.vx; P.y += P.vy; P.z += P.vz; P.vz -= 0.62; P.t++;
        if ((consume('kick') || consume('punch')) && !P.airAtk) { P.airAtk = true; P.hitSet = new Set(); SFX.whoosh(); }
        if (P.airAtk) airHit();
        if (P.z <= 0) { P.z = 0; P.vz = 0; P.st = 'land'; P.t = 0; SFX.land(); dust(P.x, P.y); }
        break;
      }
      case 'land': if (++P.t > 6) P.st = 'idle'; break;
      case 'attack': {
        const A = ATK[P.atk], step = A.seq[P.fi];
        if (P.atk !== 'special' && consume('punch')) P.queued = true;
        P.t++;
        if (A.act.includes(P.fi)) doPlayerHit(A);
        if (P.t >= step[2]) {
          P.t = 0; P.fi++; if (A.multi) P.hitSet = new Set();
          if (P.fi >= A.seq.length) {
            const wasCombo = P.atk === 'jab1' || P.atk === 'jab2';
            P.st = 'idle';
            if (wasCombo) { P.combo++; P.comboT = 22; if (P.queued) startAttack(P.combo >= 2 ? 'fin' : 'jab2'); }
            else P.combo = 0;
          }
        }
        break;
      }
      case 'hurt': P.x += P.vx; P.vx *= 0.82; if (++P.t > 18) P.st = 'idle'; break;
      case 'knock': P.x += P.vx; P.z += P.vz; P.vz -= 0.5; if (P.z <= 0) { P.z = 0; P.st = 'downed'; P.t = 0; SFX.land(); dust(P.x, P.y); G.shake = 4; } break;
      case 'downed': if (++P.t > 36) { P.st = P.hp <= 0 ? 'dying' : 'idle'; P.t = 0; P.invuln = 70; } break;
      case 'dying': if (++P.t > 80) playerLost(); break;
      case 'win': P.t++; break;
    }
    P.y = clamp(P.y, FLOOR_TOP, FLOOR_BOT);
    P.x = clamp(P.x, G.camX + 34, G.camX + W - 34);
  }
  function airHit() {
    for (const e of G.ents) {
      if ((e.kind !== 'enemy' && e.kind !== 'prop') || P.hitSet.has(e) || !hittable(e)) continue;
      const dx = (e.x - P.x) * P.face;
      if (dx > -10 && dx < 105 + (e.big ? 30 : 0) && Math.abs(e.y - P.y) < 30 && P.z < 110) { P.hitSet.add(e); damage(e, 12, 6 * P.face, true, true); }
    }
  }
  function hittable(e) {
    if (e.kind === 'prop') return e.hp > 0;
    return !['dead', 'air', 'down', 'getup', 'enter', 'under', 'drop', 'dying', 'leap'].includes(e.st) && !(e.invuln > 0);
  }
  function doPlayerHit(A) {
    for (const e of G.ents) {
      if ((e.kind !== 'enemy' && e.kind !== 'prop') || P.hitSet.has(e) || !hittable(e)) continue;
      let ok;
      if (A.radius) ok = Math.abs(e.x - P.x) < A.radius && Math.abs(e.y - P.y) < 60;
      else { const dx = (e.x - P.x) * P.face; ok = dx > -12 && dx < A.reach + (e.big ? 30 : 0) && Math.abs(e.y - P.y) < (e.big ? 34 : 26); }
      if (ok) { P.hitSet.add(e); damage(e, A.dmg, A.kb * (A.radius ? sign(e.x - P.x) : P.face), A.kd, A.heavy); }
    }
  }
  function hurtPlayer(dmg, dir, kd) {
    if (P.invuln > 0 || ['dying', 'knock', 'downed', 'win'].includes(P.st)) return false;
    if (P.st === 'attack' && P.atk === 'special') return false;
    P.hp = Math.max(0, P.hp - dmg); P.meter = Math.min(100, P.meter + 6); SFX.hurt(); G.shake = Math.max(G.shake, kd ? 7 : 4);
    sparks(P.x, P.y - 80, '#ff3f6d', 8);
    P.face = -dir; P.atk = null; P.combo = 0;
    if (kd || P.hp <= 0) { P.st = 'knock'; P.vz = 6; P.vx = dir * 4; P.z = 1; P.t = 0; if (G.boss && G.boss.st === 'think' && Math.random() < 0.5) { G.boss.st = 'taunt'; G.boss.t = 0; } }
    else { P.st = 'hurt'; P.t = 0; P.vx = dir * 4; P.invuln = 14; }
    return true;
  }
  function playerLost() {
    G.lives--;
    if (G.lives > 0) {
      P.hp = P.maxhp; P.st = 'idle'; P.invuln = 150; P.meter = Math.max(P.meter, 60);
      for (const e of G.ents) if (e.kind === 'enemy' && hittable(e) && !e.big && Math.abs(e.x - P.x) < 220) knockback(e, sign(e.x - P.x) * 6);
      spawnRing(P.x, P.y - 60);
    } else {
      G.mode = 'over'; setMusic(null); P.st = 'dying';
      for (const e of G.ents) if (e.kind === 'enemy' && (e.st === 'think' || e.st === 'hurt' || e.st === 'taunt')) { e.st = 'cheer'; e.t = 0; }
      openDialog([LEVEL1.gameOver], () => { G.mode = 'gameover'; G.t2 = 0; });
    }
  }

  /* ---------------- HOMBRES BROCA ---------------- */
  const ENEMY_TYPES = {
    broca: { hp: 46, speed: 1.7, dmg: 8, score: 200, ai: 'melee', atk: 'punch', reach: 96, skin: 'base' },
    pateador: { hp: 52, speed: 1.6, dmg: 10, score: 250, ai: 'melee', atk: 'kick', reach: 118, skin: 'dark' },
    excavador: { hp: 40, speed: 1.9, dmg: 11, score: 300, ai: 'digger', atk: 'punch', reach: 96, skin: 'red' },
  };
  function spawnEnemy(spec, side) {
    const drop = spec.endsWith('!'), type = spec.replace('!', ''), T = ENEMY_TYPES[type];
    let x = side < 0 ? G.camX - 70 : G.camX + W + 70, y = rand(FLOOR_TOP + 10, FLOOR_BOT - 10), z = 0, st = 'enter';
    if (drop) { x = clamp(P.x + side * rand(180, 300), G.camX + 80, G.camX + W - 80); y = FLOOR_TOP + rand(0, 20); z = 230; st = 'drop'; }
    const e = { kind: 'enemy', off: rand(0, 40), lane: (Math.random() * 3 | 0) - 1, type, T, x, y, z, vx: 0, vy: 0, vz: 0, face: -side, hp: T.hp, maxhp: T.hp, st, t: 0, cd: rand(30, 90), flash: 0, invuln: 0, token: false, hits: 0, walk: 0 };
    G.ents.push(e); return e;
  }
  function releaseToken(e) { if (e.token) { e.token = false; attackTokens--; } }
  function knockback(e, vx) { releaseToken(e); e.st = 'air'; e.vz = 5.5; e.vx = vx; e.z = Math.max(1, e.z); e.t = 0; }
  function damage(e, dmg, kb, kd, heavy) {
    if (e.kind === 'prop') { breakProp(e); return; }
    e.hp -= dmg; e.flash = 6; G.hitstop = heavy ? 6 : 4; G.shake = Math.max(G.shake, heavy ? 6 : 3);
    P.meter = Math.min(100, P.meter + (e.big ? 3 : 7));
    G.score += 10 * dmg; (heavy ? SFX.heavy : SFX.hit)();
    sparks(e.x, e.y - (e.big ? 120 : 80), heavy ? '#f7e04a' : '#ffffff', heavy ? 12 : 7);
    if (e.big) { bossHit(e, dmg, kb, kd); return; }
    releaseToken(e); e.hits++;
    if (e.hp <= 0 || kd || e.hits >= 4) { e.hits = 0; knockback(e, kb || sign(e.x - P.x) * 5); }
    else { e.st = 'hurt'; e.t = 0; e.vx = kb * 0.8; e.face = -sign(kb || 1); e.hurtF = (Math.random() * 3) | 0; }
  }
  function updEnemy(e) {
    if (e.flash > 0) e.flash--; if (e.invuln > 0) e.invuln--;
    if (e.big) return updBoss(e);
    const T = e.T, dxP = P.x - e.x, dyP = P.y - e.y, side = e.x < P.x ? -1 : 1;
    const playerDown = ['downed', 'dying', 'knock'].includes(P.st);
    e.t++;
    switch (e.st) {
      case 'enter': {
        const tx = side < 0 ? Math.max(G.camX + 60, P.x - 260) : Math.min(G.camX + W - 60, P.x + 260);
        e.face = sign(tx - e.x); e.x += e.face * T.speed * 1.4; e.walk++;
        if (e.x > G.camX + 40 && e.x < G.camX + W - 40) e.st = 'think';
        break;
      }
      case 'drop': e.z -= 7; e.face = sign(dxP); if (e.z <= 0) { e.z = 0; e.st = 'land'; e.t = 0; dust(e.x, e.y); SFX.land(); G.shake = 3; } break;
      case 'land': if (e.t > 14) e.st = 'think'; break;
      case 'think': {
        if (e.cd > 0) e.cd--;
        e.face = sign(dxP);
        if (T.ai === 'melee' || Math.abs(dxP) < 130) {
          const canAtk = e.cd <= 0 && (e.token || attackTokens < 2) && !playerDown;
          const tx = P.x + side * (canAtk ? T.reach - 26 : 150 + e.off), ty = canAtk ? P.y : P.y + e.lane * 40;
          moveToward(e, tx - e.x, ty - e.y, T.speed);
          if (canAtk && Math.abs(tx - e.x) < 10 && Math.abs(dyP) < 10) { if (!e.token) { e.token = true; attackTokens++; } e.st = 'wind'; e.t = 0; }
        } else {
          const tx = clamp(P.x + side * 260, G.camX + 50, G.camX + W - 50);
          moveToward(e, tx - e.x, P.y + e.lane * 30 - e.y, T.speed);
          if (e.cd <= 0 && !playerDown && Math.abs(dxP) > 140) { e.st = 'digW'; e.t = 0; SFX.dig(); }
        }
        break;
      }
      case 'wind': if (e.t > (T.atk === 'kick' ? 20 : 18)) { e.st = 'strike'; e.t = 0; e.didHit = false; SFX.whoosh(); } break;
      case 'strike': {
        if (e.t < 9 && !e.didHit) {
          const dx = (P.x - e.x) * e.face;
          if (dx > -5 && dx < T.reach && Math.abs(P.y - e.y) < 22 && P.z < 50) { e.didHit = true; hurtPlayer(T.dmg, e.face, false); }
        }
        if (e.t > 24) { e.st = 'think'; e.cd = rand(50, 110); releaseToken(e); }
        break;
      }
      case 'digW': if (e.t > 34) { e.st = 'under'; e.t = 0; dust(e.x, e.y); dust(e.x, e.y); } break;
      case 'under': {
        e.x += clamp(P.x - e.x, -4.2, 4.2); e.y += clamp(P.y - e.y, -2.5, 2.5);
        if (e.t % 6 === 0) G.fx.push({ k: 'dust', x: e.x + rand(-8, 8), y: e.y, vx: 0, r: 5, t: 20 });
        if ((Math.abs(P.x - e.x) < 6 && Math.abs(P.y - e.y) < 6) || e.t > 110) { e.st = 'emerge'; e.t = 0; e.didHit = false; SFX.crash(); G.shake = 5; dust(e.x, e.y); dust(e.x, e.y); }
        break;
      }
      case 'emerge': {
        if (e.t < 6 && !e.didHit && Math.abs(P.x - e.x) < 70 && Math.abs(P.y - e.y) < 26 && P.z < 40) { e.didHit = true; hurtPlayer(T.dmg, sign(P.x - e.x), true); }
        if (e.t > 26) { e.st = 'think'; e.cd = rand(150, 220); }
        break;
      }
      case 'hurt': e.x += e.vx; e.vx *= 0.8; if (e.t > 16) { e.st = 'think'; e.cd = Math.max(e.cd, 25); } break;
      case 'air': e.x += e.vx; e.z += e.vz; e.vz -= 0.45; if (e.z <= 0) { e.z = 0; e.vx *= 0.3; e.st = 'down'; e.t = 0; dust(e.x, e.y); SFX.land(); } break;
      case 'down': e.x += e.vx; e.vx *= 0.85; if (e.t > (e.hp <= 0 ? 20 : 50)) { if (e.hp <= 0) { e.st = 'dead'; e.t = 0; G.score += T.score; SFX.ko(); } else { e.st = 'getup'; e.t = 0; } } break;
      case 'getup': if (e.t > 16) { e.st = 'think'; e.invuln = 10; e.cd = 40; e.hits = 0; } break;
      case 'dead': if (e.t > 45) e.remove = true; break;
    }
    e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT);
    if (e.st !== 'enter') e.x = clamp(e.x, G.camX + 10, G.camX + W - 10);
  }
  function moveToward(e, dx, dy, sp) {
    if (Math.hypot(dx, dy * 1.4) < 4) { e.walk = 0; return; }
    e.x += clamp(dx, -sp, sp); e.y += clamp(dy, -sp * 0.7, sp * 0.7); e.walk++;
  }
  // [animación, frame, tendido]
  function minionFrame(e) {
    const T = e.T, t = e.t;
    switch (e.st) {
      case 'enter': return ['walk', (e.walk / 6 | 0) % 9];
      case 'think': return e.walk ? ['walk', (e.walk / 6 | 0) % 9] : ['idle', (G.t / 9 | 0) % 6];
      case 'drop': return ['jump', e.z > 120 ? 3 : 4];
      case 'land': return ['jump', 5];
      case 'wind': return T.atk === 'kick' ? ['kick', 0] : ['punch', t < 10 ? 4 : 3];
      case 'strike': return T.atk === 'kick' ? ['kick', t < 5 ? 1 : t < 10 ? 2 : t < 16 ? 3 : 6] : ['punch', t < 5 ? 0 : t < 10 ? 1 : t < 16 ? 2 : 3];
      case 'digW': return ['special', Math.min(3, t / 8 | 0)];
      case 'under': return ['special', 4];
      case 'emerge': return ['special', t < 12 ? 5 : 6];
      case 'hurt': return ['hurt', (e.hurtF || 0) * 2 + (t < 8 ? 0 : 1)];
      case 'air': return ['hurt', 6];
      case 'down': case 'dead': return ['crouch', 1, true];
      case 'getup': return ['crouch', 4];
      case 'cheer': return ['win', (G.t / 12 | 0) % 5];
    }
    return ['idle', 0];
  }

  /* ---------------- DOCTOR BROCA (jefe) ---------------- */
  const BOSS_SCALE = 1.3;
  function spawnBoss() {
    const e = { kind: 'enemy', type: 'boss', big: true, T: { score: 6000 }, x: G.camX + W + 90, y: 430, z: 0, vx: 0, vy: 0, vz: 0, face: -1, hp: LEVEL1.boss.hp, maxhp: LEVEL1.boss.hp, st: 'enter', t: 0, cd: 50, flash: 0, invuln: 0, armor: 0, armorT: 0, phase: 1, walk: 0 };
    G.ents.push(e); G.boss = e; G.bossOn = true; setMusic('boss'); SFX.boss(); G.shake = 10;
  }
  function bossHit(e, dmg, kb, kd) {
    e.armor += kd ? 3 : 1; e.armorT = 0;
    if (e.hp <= 0) { e.hp = 0; e.st = 'air'; e.vz = 6; e.vx = sign(kb || 1) * 3; e.z = Math.max(1, e.z); G.hitstop = 14; G.shake = 14; return; }
    if (e.armor >= 9) { e.armor = 0; e.st = 'air'; e.vz = 4.5; e.vx = sign(kb || 1) * 3; e.z = Math.max(1, e.z); e.t = 0; return; }
    if (e.st === 'think' || e.st === 'taunt') { e.st = 'hurt'; e.t = 0; e.vx = kb * 0.3; e.hurtF = (Math.random() * 3) | 0; }
    if (e.phase === 1 && e.hp < e.maxhp / 2) { e.phase = 2; toast(LEVEL1.bossHalf); spawnEnemy('broca!', -1); spawnEnemy('excavador', 1); }
  }
  function updBoss(e) {
    const dxP = P.x - e.x, dyP = P.y - e.y, side = e.x < P.x ? -1 : 1, p2 = e.phase === 2, sp = p2 ? 2.2 : 1.6;
    e.t++; if (++e.armorT > 180) e.armor = 0;
    const playerDown = ['downed', 'dying', 'knock'].includes(P.st);
    const hitBox = (reach, depth, dmg, kd, back = 10) => { if (e.didHit) return; const dx = (P.x - e.x) * e.face; if (dx > -back && dx < reach && Math.abs(P.y - e.y) < depth && P.z < 80) { if (hurtPlayer(dmg, e.face, kd)) e.didHit = true; } };
    switch (e.st) {
      case 'enter': e.face = -1; e.x -= 1.8; e.walk++; if (e.x < G.camX + W - 190) { e.st = 'taunt'; e.t = 0; e.walk = 0; } break;
      case 'taunt': if (e.t > 50) { e.st = 'think'; e.t = 0; } break;
      case 'think': {
        if (e.cd > 0) e.cd--;
        e.face = sign(dxP);
        moveToward(e, P.x + side * 130 - e.x, P.y - e.y, sp);
        if (e.cd <= 0 && !playerDown) {
          const r = Math.random(), close = Math.abs(dxP) < 190 && Math.abs(dyP) < 30;
          e.t = 0; e.didHit = false; e.face = sign(dxP);
          if (close) e.st = r < 0.45 ? 'jabW' : r < 0.7 ? 'spin' : r < 0.85 ? 'leapW' : 'barrageW';
          else if (Math.abs(dyP) < 24 && r < 0.35) e.st = 'dashW';
          else e.st = r < 0.6 ? 'barrageW' : 'leapW';
          if (e.st === 'spin') SFX.drill();
        }
        break;
      }
      case 'jabW': if (e.t > (p2 ? 14 : 22)) { e.st = 'jab'; e.t = 0; SFX.drill(); } break;
      case 'jab': hitBox(175, 32, 12, false); if (e.t > 22) { if (p2 && !e.combo2) { e.combo2 = true; e.st = 'jabW'; e.t = 10; e.didHit = false; } else { e.combo2 = false; e.st = 'think'; e.cd = rand(40, 80) / (p2 ? 1.4 : 1); } } break;
      case 'spin': {
        e.x += clamp(dxP, -2.4, 2.4); e.y += clamp(dyP, -1.4, 1.4);
        if (e.t % 16 === 0) e.didHit = false;
        if (!e.didHit && Math.abs(dxP) < 120 && Math.abs(dyP) < 34 && P.z < 60) { if (hurtPlayer(10, sign(dxP), true)) e.didHit = true; }
        if (e.t % 4 === 0) G.fx.push({ k: 'dust', x: e.x + rand(-40, 40), y: e.y, vx: rand(-2, 2), r: 6, t: 18 });
        if (e.t > (p2 ? 90 : 70)) { e.st = 'think'; e.cd = rand(50, 90); }
        break;
      }
      case 'barrageW': if (e.t > 32) {
        e.st = 'barrage'; e.t = 0; SFX.throw(); SFX.drill();
        const lanes = p2 ? [-70, -35, 0, 35, 70] : [-50, 0, 50];
        lanes.forEach((dy, i) => G.ents.push({ kind: 'proj', x: e.x + e.face * 120, y: clamp(e.y + dy, FLOOR_TOP, FLOOR_BOT), z: 96, vx: e.face * (6 + (i % 2)), dmg: 9, t: 0, spin: rand(0, 6) }));
      } break;
      case 'barrage': if (e.t > 28) { e.st = 'think'; e.cd = rand(50, 90); } break;
      case 'dashW': if (e.t > 26) { e.st = 'dash'; e.t = 0; e.vx = e.face * 11; SFX.drill(); } break;
      case 'dash': {
        e.x += e.vx; hitBox(150, 30, 14, true, 40);
        if (e.t % 3 === 0) G.fx.push({ k: 'after', x: e.x, y: e.y, face: e.face, a: 'special', i: 3, t: 14 });
        if (e.t > 50 || e.x < G.camX + 70 || e.x > G.camX + W - 70) { e.st = 'think'; e.cd = rand(40, 70); e.x = clamp(e.x, G.camX + 70, G.camX + W - 70); }
        break;
      }
      case 'leapW': if (e.t > 18) { e.st = 'leap'; e.t = 0; e.vz = 13; e.tx = P.x; e.ty = P.y; SFX.jump(); } break;
      case 'leap': {
        e.x += (e.tx - e.x) * 0.055; e.y += (e.ty - e.y) * 0.055; e.z += e.vz; e.vz -= 0.85;
        if (e.z <= 0) {
          e.z = 0; e.st = 'slam'; e.t = 0; G.shake = 12; SFX.crash(); dust(e.x - 40, e.y); dust(e.x + 40, e.y); spawnRing(e.x, e.y);
          if (Math.abs(P.x - e.x) < 120 && Math.abs(P.y - e.y) < 40 && P.z < 30) hurtPlayer(13, sign(P.x - e.x), true);
        }
        break;
      }
      case 'slam': if (e.t > 26) { e.st = 'think'; e.cd = rand(40, 80); } break;
      case 'hurt': e.x += e.vx; e.vx *= 0.8; if (e.t > 12) e.st = 'think'; break;
      case 'air': e.x += e.vx; e.z += e.vz; e.vz -= 0.4; if (e.z <= 0) { e.z = 0; e.st = 'down'; e.t = 0; G.shake = 8; dust(e.x, e.y); dust(e.x - 40, e.y); SFX.land(); } break;
      case 'down': if (e.t > (e.hp <= 0 ? 30 : 60)) { if (e.hp <= 0) { e.st = 'dying'; e.t = 0; bossDefeated(); } else { e.st = 'getup'; e.t = 0; } } break;
      case 'getup': if (e.t > 22) { e.st = 'think'; e.invuln = 20; e.cd = 20; } break;
    }
    e.y = clamp(e.y, FLOOR_TOP, FLOOR_BOT);
    if (e.st !== 'enter') e.x = clamp(e.x, G.camX + 50, G.camX + W - 50);
  }
  function bossFrame(e) {
    const t = e.t;
    switch (e.st) {
      case 'enter': return ['move', (e.walk / 6 | 0) % 6];
      case 'taunt': return ['win', (t / 12 | 0) % 2];
      case 'think': return e.walk ? ['move', (e.walk / 6 | 0) % 6] : ['idle', (G.t / 14 | 0) % 3];
      case 'jabW': return ['jab', 0];
      case 'jab': return ['jab', t < 8 ? 1 : 2];
      case 'spin': return ['spin', (t / 4 | 0) % 2];
      case 'barrageW': return ['special', t < 18 ? 0 : 1];
      case 'barrage': return ['special', 2];
      case 'dashW': return ['special', 0];
      case 'dash': return ['special', 3];
      case 'leapW': return ['jump', 0];
      case 'leap': return ['jump', e.vz > 2 ? 1 : 3];
      case 'slam': return ['jump', 2];
      case 'hurt': return ['dmg', e.hurtF || 0];
      case 'air': return ['dmg', e.vz > 0 ? 3 : 4];
      case 'down': return ['dmg', 6];
      case 'getup': return ['dmg', 2];
      case 'dying': return ['dmg', t < 40 ? 5 : 6];
      case 'cheer': return ['win', 2];
    }
    return ['idle', 0];
  }
  function bossDefeated() {
    G.score += 6000; G.bossDone = true; SFX.ko();
    for (const e of G.ents) if (e.kind === 'enemy' && !e.big && e.st !== 'dead') { e.hp = 0; knockback(e, sign(e.x - P.x) * 5); }
    for (const p of G.ents) if (p.kind === 'proj') p.remove = true;
    setTimeout(() => {
      P.st = 'win'; P.t = 0; setMusic('win');
      G.banner = { text: '¡EL PREMIERE ESTÁ A SALVO!', t: 999 };
      setTimeout(() => openDialog(LEVEL1.victory, () => { G.mode = 'victory'; G.t2 = 0; }), 1800);
    }, 900);
  }

  /* ---------------- OBJETOS, PROYECTILES, EFECTOS ---------------- */
  function breakProp(e) {
    e.hp = 0; e.remove = true; SFX.crash(); G.hitstop = 3;
    const cols = e.look === 'matera' ? ['#b5552f', '#8a3b1d', '#2f7a3a', '#ee4fa6'] : ['#c9a46a', '#8a6a3a', '#4a2a18', '#6b3f22'];
    for (let i = 0; i < 10; i++) G.fx.push({ k: 'debris', x: e.x, y: e.y, z: 30, vx: rand(-3, 3), vz: rand(2, 6), t: 50, c: cols[i % 4] });
    G.ents.push({ kind: 'pickup', x: e.x, y: e.y, z: 20, vz: 4, item: e.drop, t: 0 });
  }
  function updProj(p) {
    p.x += p.vx; p.t++;
    if (P.z < 70 && Math.abs(P.x - p.x) < 30 && Math.abs(P.y - p.y) < 20) { if (hurtPlayer(p.dmg, sign(p.vx), false)) { p.remove = true; sparks(p.x, p.y - p.z, '#c98a4a', 6); } }
    if (P.st === 'attack' && Math.abs(P.y - p.y) < 22) { const dx = (p.x - P.x) * P.face; if (dx > 0 && dx < 95 && ATK[P.atk].act.includes(P.fi)) { p.remove = true; sparks(p.x, p.y - p.z, '#ffffff', 6); SFX.hit(); G.score += 50; } }
    if (p.x < G.camX - 60 || p.x > G.camX + W + 60) p.remove = true;
  }
  function updPickup(k) {
    if (k.z > 0 || k.vz > 0) { k.z += k.vz; k.vz -= 0.4; if (k.z <= 0) { k.z = 0; k.vz = 0; } }
    k.t++;
    if (k.z === 0 && Math.abs(P.x - k.x) < 36 && Math.abs(P.y - k.y) < 22 && P.st !== 'dying') {
      k.remove = true;
      if (k.item === 'cup') { P.hp = Math.min(P.maxhp, P.hp + 40); SFX.pickup(); G.fx.push({ k: 'text', x: k.x, y: k.y - 60, txt: '+40 TINTO', t: 60, c: '#ffd28a' }); }
      else { G.score += 1000; SFX.coin(); G.fx.push({ k: 'text', x: k.x, y: k.y - 60, txt: '+1000 GRANO DE ORO', t: 60, c: '#f7e04a' }); }
    }
  }
  function sparks(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(2, 7); G.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(10, 18) | 0, c }); } G.fx.push({ k: 'star', x, y, t: 8, c }); }
  function dust(x, y) { for (let i = 0; i < 6; i++) G.fx.push({ k: 'dust', x: x + rand(-20, 20), y, vx: rand(-1.5, 1.5), r: rand(4, 9), t: 24 }); }
  function spawnRing(x, y) { G.fx.push({ k: 'ring', x, y, t: 26 }); }
  function updFx() {
    for (const f of G.fx) {
      f.t--;
      if (f.k === 'spark') { f.x += f.vx; f.y += f.vy; f.vx *= 0.9; f.vy *= 0.9; }
      else if (f.k === 'dust') { f.x += f.vx; f.r += 0.3; }
      else if (f.k === 'debris') { f.x += f.vx; f.z += f.vz; f.vz -= 0.35; if (f.z < 0) { f.z = 0; f.vz *= -0.4; f.vx *= 0.6; } }
      else if (f.k === 'text') f.y -= 0.8;
    }
    G.fx = G.fx.filter(f => f.t > 0);
  }

  /* ---------------- OLEADAS Y CÁMARA ---------------- */
  function updWaves() {
    const L = LEVEL1;
    if (!G.lock) {
      const next = G.nextWave < L.waves.length ? L.waves[G.nextWave].camX : L.bossCamX;
      G.camX = clamp(Math.max(G.camX, P.x - W * 0.42), 0, Math.min(next, LEVEL_W - W));
      if (G.camX >= next - 0.5) {
        if (G.nextWave < L.waves.length) { G.lock = { wave: L.waves[G.nextWave], group: 0, delay: 20 }; G.nextWave++; }
        else if (!G.bossOn && !G.bossDone) { G.lock = { boss: true }; openDialog(L.preBoss, () => { spawnBoss(); G.banner = { text: L.boss.name, sub: L.boss.subtitle, t: 170 }; }); }
      }
    } else if (G.lock.wave) {
      const alive = G.ents.filter(e => e.kind === 'enemy' && e.st !== 'dead').length;
      if (G.lock.delay > 0) G.lock.delay--;
      else if (G.lock.group < G.lock.wave.groups.length && alive <= 1) {
        const grp = G.lock.wave.groups[G.lock.group++];
        grp.forEach((t, i) => setTimeout(() => { if (G.mode !== 'title') spawnEnemy(t, i % 2 ? -1 : 1); }, i * 500));
        G.lock.delay = 70;
      } else if (G.lock.group >= G.lock.wave.groups.length && alive === 0 && G.lock.delay <= 0) {
        const wi = L.waves.indexOf(G.lock.wave); G.lock = null; G.go = 150;
        if (L.waveToasts[wi]) toast(L.waveToasts[wi]);
      }
    }
    if (G.go > 0) G.go--;
  }

  /* ---------------- BUCLE PRINCIPAL ---------------- */
  function update() {
    G.t++;
    for (const k in IN.buf) if (IN.buf[k] > 0) IN.buf[k]--;
    if (consume('mute')) setMuted(!audio.isMuted());
    switch (G.mode) {
      case 'title':
        if (confirmPressed()) { SFX.select(); resetLevel(); G.mode = 'story'; setMusic('title'); openDialog(LEVEL1.intro, () => { G.mode = 'play'; setMusic('level'); }); }
        break;
      case 'dialog': updDialog(); if (P && P.st === 'win') P.t++; break;
      case 'pause': if (consume('pause') || consume('start')) G.mode = 'play'; break;
      case 'gameover': G.t2++; if (G.t2 > 40 && confirmPressed()) { SFX.select(); continueFromCheckpoint(); } break;
      case 'victory': G.t2++; if (G.t2 > 60 && confirmPressed()) { SFX.select(); G.mode = 'title'; setMusic('title'); } break;
      case 'play': {
        if (consume('pause')) { G.mode = 'pause'; break; }
        if (G.hitstop > 0) { G.hitstop--; break; }
        updPlayer();
        for (const e of G.ents) { if (e.kind === 'enemy') updEnemy(e); else if (e.kind === 'proj') updProj(e); else if (e.kind === 'pickup') updPickup(e); }
        G.ents = G.ents.filter(e => !e.remove);
        updWaves(); updFx();
        if (G.shake > 0) G.shake *= 0.85; if (G.shake < 0.3) G.shake = 0;
        if (G.toast && --G.toast.t <= 0) G.toast = null;
        if (G.banner && G.banner.t < 999 && --G.banner.t <= 0) G.banner = null;
        break;
      }
    }
    if (G.mode !== 'play' && G.mode !== 'title') { updFx(); for (const e of G.ents) if (e.kind === 'enemy' && (e.st === 'cheer' || e.st === 'dying' || e.st === 'taunt')) e.t++; }
  }

  /* ---------------- DIBUJO ---------------- */
  function drawWorld() {
    const cx = G.camX, sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) * 0.6 : 0;
    ctx.save(); ctx.translate(Math.round(sx), Math.round(sy));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(BG.sky, (cx * 0.03) % 40, 0, 440, 270, 0, 0, W, H);
    ctx.drawImage(BG.far, cx * 0.12, 0, 480, 270, 0, 0, W, H);
    ctx.drawImage(BG.near, cx / 2, 0, W / 2, 270, 0, 0, W, H);
    // letrero del Café Premiere en el segundo piso
    const lx = 3980 - cx;
    if (lx > -200 && lx < W + 200) {
      ctx.imageSmoothingEnabled = true;
      const lw = 150, lh = lw * IMG.logo.height / IMG.logo.width, ly = 38;
      ctx.fillStyle = '#4a2a18'; ctx.fillRect(lx - lw / 2 - 6, ly - 6, lw + 12, lh + 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(lx - lw / 2 + 4, ly + lh + 6, lw, 6);
      ctx.drawImage(IMG.logo, lx - lw / 2, ly, lw, lh);
      ctx.imageSmoothingEnabled = false;
    }
    const list = G.ents.slice().sort((a, b) => a.y - b.y);
    for (const e of list) if (e.st !== 'under') shadow(e.x - cx, e.y, e.big ? 62 : e.kind === 'pickup' ? 18 : e.kind === 'proj' ? 14 : 36);
    for (const f of G.fx) if (f.k === 'dust') { ctx.fillStyle = `rgba(120,95,70,${f.t / 40})`; ctx.beginPath(); ctx.arc(f.x - cx, f.y - 4, f.r, 0, 7); ctx.fill(); }
    ctx.imageSmoothingEnabled = true;
    for (const f of G.fx) if (f.k === 'after') drawFrame(IMG.broca, BROCA_META, f.a, f.i, f.x - cx, f.y, f.face, BOSS_SCALE, f.t / 30);
    ctx.imageSmoothingEnabled = false;
    for (const e of list) {
      if (e.kind === 'player') drawPlayer(cx);
      else if (e.kind === 'enemy') drawEnemy(e, cx);
      else if (e.kind === 'prop') drawProp(e, cx);
      else if (e.kind === 'pickup') drawPickup(e, cx);
      else if (e.kind === 'proj') drawProj(e, cx);
    }
    drawFx(cx);
    ctx.restore();
  }
  function shadow(x, y, r) { ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.28, 0, 0, 7); ctx.fill(); }
  function playerFrame() {
    const s = P.st;
    if (s === 'idle') return ['idle', (G.t / 10 | 0) % 5];
    if (s === 'walk') return ['walk', (P.t / 5 | 0) % 8];
    if (s === 'jump') { if (P.airAtk) return ['crouch', 3]; return ['jump', P.vz > 6 ? 1 : P.vz > 1 ? 2 : P.vz > -4 ? 3 : 4]; }
    if (s === 'land') return ['jump', 5];
    if (s === 'attack') { const st = ATK[P.atk].seq[P.fi]; return [st[0], st[1]]; }
    if (s === 'hurt') return ['hurt', P.t < 8 ? 0 : 2];
    if (s === 'knock') return ['hurt', 1];
    if (s === 'downed') return P.t < 20 ? ['crouch', 0] : ['jump', 5];
    if (s === 'dying') return ['hurt', 3 + (P.t / 10 | 0) % 4];
    if (s === 'win') { const k = P.t / 12 | 0; return ['win', k < 3 ? k + 1 : 0]; }
    return ['idle', 0];
  }
  function drawPlayer(cx) {
    if (P.invuln > 0 && P.st !== 'attack' && (G.t >> 2) % 2 && P.st !== 'win') return;
    const [a, i] = playerFrame();
    drawHero(a, i, P.x - cx, P.y - P.z, P.face);
  }
  function drawEnemy(e, cx) {
    if (e.st === 'dead' && (e.t >> 2) % 2) return;
    if (e.st === 'enter' && (e.x < G.camX - 120 || e.x > G.camX + W + 120)) return;
    const x = e.x - cx, y = e.y - e.z;
    if (e.big) {
      const [a, i] = bossFrame(e);
      ctx.imageSmoothingEnabled = true;
      drawFrame(e.flash > 0 && e.flash % 2 === 0 ? IMG.brocaW : IMG.broca, BROCA_META, a, i, x, y, e.face, BOSS_SCALE);
      ctx.imageSmoothingEnabled = false;
    } else {
      if (e.st === 'under') { drawFrame(IMG.minion, MINION_META, 'special', 4, x, y + 6, e.face, 0.5, 0.85); return; }
      const [a, i, lying] = minionFrame(e);
      const img = e.flash > 0 && e.flash % 2 === 0 ? IMG.minionW : IMG.minionT[e.T.skin];
      if (lying) drawFrame(img, MINION_META, a, i, x, y + 6, e.face, 1, 1, -e.face * 1.3);
      else drawFrame(img, MINION_META, a, i, x, y, e.face);
    }
    if (['wind', 'jabW', 'dashW', 'barrageW', 'leapW', 'digW'].includes(e.st) && (G.t >> 2) % 2) {
      const yy = y - (e.big ? 200 : 150);
      ctx.font = `16px ${FONT_HUD}`; ctx.textAlign = 'center';
      ctx.fillStyle = '#120818'; ctx.fillText('!', x + 2, yy + 2); ctx.fillStyle = '#f7e04a'; ctx.fillText('!', x, yy);
    }
  }
  function drawProp(e, cx) {
    const x = e.x - cx, y = e.y;
    if (e.look === 'matera') {
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#2f7a3a' : '#3c8f46'; ctx.beginPath(); ctx.ellipse(x - 20 + i * 5, y - 58 - (i % 3) * 8, 6, 12, (i - 4) * 0.25, 0, 7); ctx.fill(); }
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#ee4fa6' : '#d42a8a'; ctx.fillRect(x - 18 + i * 6, y - 76 + (i % 3) * 7, 5, 5); }
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(x - 26, y - 49); ctx.lineTo(x + 26, y - 49); ctx.lineTo(x + 19, y + 1); ctx.lineTo(x - 19, y + 1); ctx.fill();
      ctx.fillStyle = '#b5552f'; ctx.beginPath(); ctx.moveTo(x - 23, y - 46); ctx.lineTo(x + 23, y - 46); ctx.lineTo(x + 17, y - 1); ctx.lineTo(x - 17, y - 1); ctx.fill();
      ctx.fillStyle = '#d06a43'; ctx.fillRect(x - 25, y - 50, 50, 7); ctx.fillStyle = '#8a3b1d'; ctx.fillRect(x - 20, y - 28, 40, 3);
    } else {
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(x, y - 30, 30, 34, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9a46a'; ctx.beginPath(); ctx.ellipse(x, y - 30, 27, 31, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(120,90,50,0.45)'; for (let i = -24; i < 26; i += 5) ctx.fillRect(x + i, y - 58, 1, 54);
      ctx.fillStyle = '#c9a46a'; ctx.fillRect(x - 10, y - 70, 20, 10); ctx.fillStyle = '#6b3f22'; ctx.fillRect(x - 12, y - 62, 24, 3);
      ctx.fillStyle = '#4a2a18'; ctx.font = `9px ${FONT_HUD}`; ctx.textAlign = 'center'; ctx.fillText('CAFÉ', x, y - 28);
      ctx.fillStyle = '#b8322a'; ctx.fillText('★', x, y - 14);
    }
  }
  function drawBean(x, y, s, rot, gold) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (!gold) { const b = BROCA_META.bean[0]; ctx.drawImage(IMG.broca, b[0], b[1], b[2], b[3], -b[2] / 2, -b[3] / 2, b[2], b[3]); }
    else {
      ctx.fillStyle = '#3a2410'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f7d24a'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b8891c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(0, -5, 12, 1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-8, -7, 5, 2);
    }
    ctx.restore();
  }
  function drawPickup(k, cx) {
    const x = k.x - cx, y = k.y - k.z - 4 + Math.sin(k.t / 8) * 2;
    if (k.item === 'cup') {
      ctx.fillStyle = '#120818'; ctx.fillRect(x - 14, y - 26, 28, 28); ctx.fillRect(x + 12, y - 20, 8, 12);
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(x - 12, y - 24, 24, 24); ctx.fillRect(x + 12, y - 18, 5, 8);
      ctx.fillStyle = '#6a3a1e'; ctx.fillRect(x - 10, y - 22, 20, 4);
      ctx.fillStyle = '#c2312b'; ctx.font = `10px ${FONT_HUD}`; ctx.textAlign = 'center'; ctx.fillText('P', x, y - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) ctx.fillRect(x - 6 + i * 6, y - 34 - ((k.t / 4 + i * 3) % 8), 2, 5);
    } else {
      drawBean(x, y - 16, 1.1, Math.sin(k.t / 10) * 0.4, true);
      if ((k.t >> 3) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 10, y - 30, 3, 3); }
    }
  }
  function drawProj(p, cx) { ctx.imageSmoothingEnabled = true; drawBean(p.x - cx, p.y - p.z, 0.75, p.spin + p.t * 0.3, false); ctx.imageSmoothingEnabled = false; }
  function drawFx(cx) {
    for (const f of G.fx) {
      const x = f.x - cx;
      if (f.k === 'spark') { ctx.fillStyle = f.c; ctx.fillRect(x - 2, f.y - 2, 5, 5); }
      else if (f.k === 'star') { ctx.save(); ctx.translate(x, f.y); ctx.rotate(G.t * 0.3); ctx.fillStyle = f.c; const r = 26 - f.t * 2; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.fill(); } ctx.restore(); }
      else if (f.k === 'debris') { ctx.fillStyle = f.c; ctx.fillRect(x - 4, f.y - f.z - 4, 8, 6); }
      else if (f.k === 'ring') { const r = (26 - f.t) * 9; ctx.strokeStyle = `rgba(247,224,74,${f.t / 26})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, f.y, r, r * 0.45, 0, 0, 7); ctx.stroke(); }
      else if (f.k === 'text') { ctx.font = `13px ${FONT_HUD}`; ctx.textAlign = 'center'; ctx.fillStyle = '#120818'; ctx.fillText(f.txt, x + 2, f.y + 2); ctx.fillStyle = f.c; ctx.fillText(f.txt, x, f.y); }
    }
  }
  function bar(x, y, w, h, v, c1, c2) {
    ctx.fillStyle = '#120818'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#2b2040'; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y, Math.max(0, w * v), h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.max(0, w * v), 2);
    ctx.fillStyle = '#120818'; for (let i = 1; i < 10; i++) ctx.fillRect(x + w * i / 10, y, 2, h);
  }
  function hudText(t, x, y, size, c, align = 'left') { ctx.font = `${size}px ${FONT_HUD}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#120818'; ctx.fillText(t, x + 2, y + 2); ctx.fillStyle = c; ctx.fillText(t, x, y); }
  function drawHUD() {
    ctx.fillStyle = 'rgba(18,8,24,0.55)'; ctx.fillRect(8, 8, 396, 84);
    ctx.fillStyle = '#120818'; ctx.fillRect(14, 12, 74, 74); ctx.fillStyle = '#e0b81c'; ctx.fillRect(16, 14, 70, 70); ctx.fillStyle = '#2e6fb7'; ctx.fillRect(19, 17, 64, 64);
    const fr = HERO_META.idle[0]; ctx.save(); ctx.beginPath(); ctx.rect(19, 17, 64, 64); ctx.clip(); ctx.drawImage(IMG.hero, fr[0], fr[1], fr[2], 70, 51 - fr[4] * 1.1, 20, fr[2] * 1.1, 77); ctx.restore();
    hudText('CAPITÁN PREMIERE', 100, 30, 12, '#f2ead8');
    bar(100, 40, 260, 16, P.hp / P.maxhp, P.hp < 30 ? '#ff6b6b' : '#7dff8a', P.hp < 30 ? '#c2312b' : '#2f9e5a');
    const full = P.meter >= 100;
    bar(100, 66, 180, 8, P.meter / 100, full && (G.t >> 3) % 2 ? '#ffffff' : '#f7e04a', '#c98a1a');
    hudText(full ? 'ESPECIAL LISTO' : 'ESPECIAL', 292, 75, 8, full ? '#f7e04a' : '#d8cfe8');
    hudText('×' + G.lives, 370, 56, 14, '#f7e04a');
    ctx.fillStyle = 'rgba(18,8,24,0.55)'; ctx.fillRect(W - 170, 8, 162, 56);
    hudText(String(G.score).padStart(7, '0'), W - 18, 34, 16, '#ffffff', 'right');
    hudText('PUNTOS', W - 18, 54, 8, '#f2ead8', 'right');
    if (G.bossOn && G.boss && !G.bossDone) {
      hudText(LEVEL1.boss.name, W / 2, H - 46, 12, '#f7e04a', 'center');
      bar(W / 2 - 230, H - 36, 460, 16, G.boss.hp / G.boss.maxhp, '#9fd36a', '#2f6b3a');
    }
    if (G.go > 0 && (G.t >> 4) % 2) hudText('¡ADELANTE! ▶', W - 40, H / 2 - 40, 22, '#f7e04a', 'right');
    if (G.banner) {
      const a = Math.min(1, G.banner.t / 20);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(30,14,8,0.82)'; ctx.fillRect(0, 150, W, G.banner.sub ? 90 : 64);
      ctx.fillStyle = '#b8322a'; ctx.fillRect(0, 150, W, 3); ctx.fillRect(0, 150 + (G.banner.sub ? 87 : 61), W, 3);
      hudText(G.banner.text, W / 2, 192, 22, '#f7e04a', 'center');
      if (G.banner.sub) { ctx.font = `28px ${FONT_TXT}`; ctx.fillStyle = '#f2ead8'; ctx.textAlign = 'center'; ctx.fillText(G.banner.sub, W / 2, 225); }
      ctx.globalAlpha = 1;
    }
    if (G.toast) drawToast();
  }
  function wrap(text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function crtFrame(x, y, s) { ctx.fillStyle = '#120818'; ctx.fillRect(x - 6, y - 6, s + 12, s + 12); ctx.fillStyle = '#3a2a55'; ctx.fillRect(x - 4, y - 4, s + 8, s + 8); ctx.fillStyle = '#071a0c'; ctx.fillRect(x, y, s, s); }
  function drawToast() {
    const T = G.toast, a = Math.min(1, T.t / 20, (260 - T.t) / 12);
    ctx.save(); ctx.globalAlpha = a;
    const x = 16, y = H - 130, w = 470;
    ctx.fillStyle = 'rgba(12,8,22,0.9)'; ctx.fillRect(x, y, w, 100); ctx.strokeStyle = '#7dff8a'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, 98);
    crtFrame(x + 14, y + 14, 72); drawFace(T.expr, x + 14, y + 14, 72);
    ctx.fillStyle = BG.scan; ctx.fillRect(x + 14, y + 14, 72, 72);
    ctx.font = `10px ${FONT_HUD}`; ctx.fillStyle = '#7dff8a'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('ALFONSO', x + 104, y + 28);
    ctx.font = `26px ${FONT_TXT}`; ctx.fillStyle = '#f2ead8';
    wrap(T.text, w - 120).forEach((l, i) => ctx.fillText(l, x + 104, y + 54 + i * 22));
    ctx.restore();
  }
  function drawDialog() {
    const D = G.dialog; if (!D) return;
    const [expr, text] = D.lines[D.i];
    ctx.fillStyle = 'rgba(6,3,14,0.5)'; ctx.fillRect(0, 0, W, H);
    const x = 30, y = H - 196, w = W - 60, h = 176;
    ctx.fillStyle = '#0c0816'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#7dff8a'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = '#2f9e5a'; ctx.lineWidth = 1; ctx.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
    const ps = 140; crtFrame(x + 18, y + 18, ps);
    const talking = D.chars < text.length && (G.t >> 3) % 2;
    drawFace(talking && expr !== 15 ? [1, 0, 3, 1][expr % 4] : expr, x + 18, y + 18, ps);
    ctx.fillStyle = BG.scan; ctx.fillRect(x + 18, y + 18, ps, ps);
    ctx.fillStyle = 'rgba(125,255,138,0.06)'; ctx.fillRect(x + 18, y + 18 + ((G.t * 2) % ps), ps, 6);
    ctx.font = `12px ${FONT_HUD}`; ctx.fillStyle = '#7dff8a'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ALFONSO HERNÁNDEZ MURCIA', x + 184, y + 38);
    ctx.font = `9px ${FONT_HUD}`; ctx.fillStyle = '#2f9e5a'; ctx.fillText('CABINA DEL CAFÉ PREMIERE', x + 184, y + 56);
    ctx.font = `32px ${FONT_TXT}`; ctx.fillStyle = '#e8ffe9';
    const shown = text.slice(0, Math.floor(D.chars));
    wrap(text, w - 210).reduce((acc, l, i) => { ctx.fillText(shown.slice(acc, acc + l.length), x + 184, y + 94 + i * 30); return acc + l.length + 1; }, 0);
    if (D.chars >= text.length && (G.t >> 4) % 2) { ctx.font = `10px ${FONT_HUD}`; ctx.fillStyle = '#7dff8a'; ctx.textAlign = 'right'; ctx.fillText('CONTINUAR ▼', x + w - 22, y + h - 18); }
    ctx.font = `8px ${FONT_HUD}`; ctx.fillStyle = '#5a7a62'; ctx.textAlign = 'right'; ctx.fillText(`${D.i + 1}/${D.lines.length}`, x + w - 22, y + 30);
  }
  function drawTitle() {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(BG.sky, 0, 0, 440, 270, 0, 0, W, H);
    ctx.drawImage(BG.far, (G.t * 0.25) % 900, 0, 480, 270, 0, 0, W, H);
    ctx.drawImage(BG.near, 1750, 0, 480, 270, 0, 0, W, H);
    const vg = ctx.createLinearGradient(0, 0, 0, H); vg.addColorStop(0, 'rgba(25,12,6,0.6)'); vg.addColorStop(0.6, 'rgba(25,12,6,0.74)'); vg.addColorStop(1, 'rgba(25,12,6,0.86)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    const lw = 200, lh = lw * IMG.logo.height / IMG.logo.width;
    ctx.fillStyle = '#120818'; ctx.fillRect(44, 26, lw + 12, lh + 12);
    ctx.drawImage(IMG.logo, 50, 32, lw, lh);
    const tx = 610; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const lg = ctx.createLinearGradient(0, 60, 0, 190); lg.addColorStop(0, '#fff3a8'); lg.addColorStop(0.5, '#f7d01c'); lg.addColorStop(1, '#e09a10');
    ctx.font = `64px ${FONT_LOGO}`;
    ctx.fillStyle = '#120818'; ctx.fillText('CAPITÁN', tx + 5, 105); ctx.fillText('PREMIERE', tx + 5, 175);
    ctx.fillStyle = lg; ctx.fillText('CAPITÁN', tx, 100); ctx.fillText('PREMIERE', tx, 170);
    ctx.font = `26px ${FONT_LOGO}`; ctx.fillStyle = '#120818'; ctx.fillText('VS', tx + 3, 218); ctx.fillStyle = '#e8473c'; ctx.fillText('VS', tx, 215);
    ctx.font = `40px ${FONT_LOGO}`; ctx.fillStyle = '#120818'; ctx.fillText('EL DOCTOR BROCA', tx + 4, 268); ctx.fillStyle = '#9fd36a'; ctx.fillText('EL DOCTOR BROCA', tx, 264);
    if ((G.t >> 5) % 2) hudText(isTouch() ? 'TOCA PARA EMPEZAR' : 'PRESIONA ENTER', tx, 314, 16, '#f2ead8', 'center');
    ctx.imageSmoothingEnabled = false;
    drawHero('idle', (G.t / 10 | 0) % 5, 300, 522, 1);
    ctx.imageSmoothingEnabled = true;
    drawFrame(IMG.minion, MINION_META, 'idle', (G.t / 9 | 0) % 6, 715, 515, -1, 0.9);
    drawFrame(IMG.broca, BROCA_META, 'idle', (G.t / 14 | 0) % 3, 880, 525, -1, BOSS_SCALE);
    ctx.imageSmoothingEnabled = false;
    if (!isTouch()) {
      const lines = [['MOVER', 'FLECHAS / WASD'], ['PUÑO (COMBO)', 'J / Z'], ['PATADA', 'K / X'], ['SALTAR', 'ESPACIO / L'], ['ESPECIAL', 'I / V o J+K'], ['BARRIDA', '↓ + PATADA']];
      lines.forEach(([a, b], i) => { const cx = 400 + (i % 2) * 170, cy = 372 + (i >> 1) * 36; hudText(a, cx, cy, 9, '#f7d01c'); hudText(b, cx, cy + 15, 8, '#e8dcc8'); });
    }
    hudText('M: SONIDO   P: PAUSA', W - 20, 24, 8, '#c8b8a0', 'right');
  }
  function drawCenterPanel(title, lines, c) {
    ctx.fillStyle = 'rgba(14,8,4,0.78)'; ctx.fillRect(0, 0, W, H);
    hudText(title, W / 2, 200, 30, c, 'center');
    lines.forEach((l, i) => hudText(l, W / 2, 260 + i * 34, 14, '#f2ead8', 'center'));
  }
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    if (G.mode === 'loading') { ctx.fillStyle = '#1a0f08'; ctx.fillRect(0, 0, W, H); hudText('CARGANDO...', W / 2, H / 2, 16, '#f7d01c', 'center'); return; }
    if (G.mode === 'title') drawTitle();
    else {
      drawWorld(); drawHUD();
      if (G.mode === 'pause') drawCenterPanel('PAUSA', ['P o ENTER para seguir', 'M: sonido ' + (audio.isMuted() ? 'apagado' : 'encendido')], '#f7d01c');
      if (G.mode === 'gameover') drawCenterPanel('GAME OVER', ['Puntos: ' + G.score, (G.t2 > 40 && (G.t >> 4) % 2) ? (isTouch() ? 'TOCA PARA CONTINUAR' : 'ENTER PARA CONTINUAR') : ''], '#e8473c');
      if (G.mode === 'victory') drawCenterPanel('NIVEL 1 COMPLETADO', ['Puntos: ' + G.score, 'El Doctor Broca volverá...', (G.t2 > 60 && (G.t >> 4) % 2) ? 'ENTER / TOCA PARA VOLVER AL INICIO' : ''], '#f7d01c');
      if (G.dialog) drawDialog();
    }
    ctx.fillStyle = BG.scan || 'transparent'; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- ARRANQUE ---------------- */
  function isTouch() { return !!(hooks.isTouch && hooks.isTouch()); }
  // tocar la pantalla del juego confirma en menús y diálogos
  on(cv, 'pointerdown', () => { audioInit(); if (G.mode !== 'play') { press('start'); setTimeout(() => release('start'), 60); } });
  let last = 0, acc = 0, raf = 0, alive = true;
  function frame(ts) {
    if (!alive) return;
    if (!last) last = ts; acc += Math.min(100, ts - last); last = ts;
    while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
    render(); raf = requestAnimationFrame(frame);
  }
  async function boot() {
    raf = requestAnimationFrame(frame);
    try { await Promise.all([document.fonts.load(`20px ${FONT_HUD}`), document.fonts.load(`20px ${FONT_TXT}`), document.fonts.load(`40px ${FONT_LOGO}`)]); } catch (e) { /* usa fuentes de respaldo */ }
    [IMG.hero, IMG.alf, IMG.broca, IMG.minion, IMG.logo] = await Promise.all([loadImg(assets.hero.src), loadImg(assets.alfonso), loadImg(assets.broca.src), loadImg(assets.minion.src), loadImg(assets.logo)]);
    if (!alive) return;
    IMG.brocaW = whiteOf(IMG.broca); IMG.minionW = whiteOf(IMG.minion);
    IMG.minionT = { base: IMG.minion, dark: tinted(IMG.minion, [0.55, 0.6, 0.75], [0, 4, 12]), red: tinted(IMG.minion, [1.45, 0.7, 0.5], [26, 0, 0]) };
    buildBackgrounds();
    G.mode = 'title';
    if (hooks.debug) window.__cp = { G, IN };
  }
  boot();

  return {
    press, release, setMuted,
    isMuted: () => audio.isMuted(),
    togglePause() { if (G.mode === 'play') G.mode = 'pause'; else if (G.mode === 'pause') G.mode = 'play'; },
    destroy() { alive = false; cancelAnimationFrame(raf); cleanup.forEach(f => f()); audio.destroy(); },
  };
  }
