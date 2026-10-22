/* =========================================================
   CAPITÁN PREMIER — motor del juego.
   createGame(canvas, assets, hooks) arranca el juego en un <canvas>
   y devuelve controles para React (entrada táctil, sonido, pausa).
   ========================================================= */
import { LEVELS, GAME_OVER_LINES, CAST } from './content.js';
import { createAudio } from './audio.js';
import { createGamepad } from './gamepad.js';

export function createGame(canvas, assets, hooks = {}) {
  const cleanup = [];
  const on = (target, ev, fn, opt) => { target.addEventListener(ev, fn, opt); cleanup.push(() => target.removeEventListener(ev, fn, opt)); };
  const HERO_META = assets.hero.meta;
  const SHEETS = {}; // hojas de sprites cargadas: { img, white, meta }
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
    KeyI: 'special', KeyV: 'special', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyG: 'padcfg', KeyR: 'padreset', Backspace: 'exit',
  };
  function press(a) { if (!IN.held[a]) IN.buf[a] = 9; IN.held[a] = true; audioInit(); G.lastInput = G.t; }
  function release(a) { IN.held[a] = false; }
  function consume(a) { if (IN.buf[a] > 0) { IN.buf[a] = 0; return true; } return false; }
  function confirmPressed() { return consume('start') | consume('punch') | consume('kick') | consume('jump'); }
  on(window, 'keydown', e => { G.lastInput = G.t; const a = KEYMAP[e.code]; if (!a) { if ((G.mode === 'splash' || G.mode === 'cast') && !e.repeat) { press('start'); release('start'); } return; } e.preventDefault(); if (e.repeat) return; press(a); });
  on(window, 'keyup', e => { const a = KEYMAP[e.code]; if (a) release(a); });
  on(window, 'blur', () => { for (const k in IN.held) IN.held[k] = false; });

  /* ---------------- AUDIO ---------------- */
  const audio = createAudio();
  const SFX = audio.SFX, setMusic = audio.setMusic, audioInit = audio.init;
  function setMuted(m) { audio.setMuted(m); hooks.onMuteChange && hooks.onMuteChange(m); }

  /* ---------------- MANDO (Xbox, PlayStation, genéricos) ---------------- */
  const pad = createGamepad({
    press: a => press(a), release: a => release(a), getMode: () => G.mode,
    onChange(connected, name, nonStandard) {
      G.notice = !connected ? { text: 'MANDO DESCONECTADO', t: 150 }
        : nonStandard ? { text: 'MANDO DETECTADO · SI NO RESPONDE BIEN, CONFIGÚRALO (BOTÓN MANDO)', t: 330 }
        : { text: `${shortPadName(name)} CONECTADO`, t: 150 };
      hooks.onGamepad && hooks.onGamepad(connected);
    },
  });
  cleanup.push(() => pad.destroy());
  function shortPadName(id) {
    const s = id.toLowerCase();
    if (s.includes('xbox') || s.includes('xinput') || s.includes('045e')) return 'MANDO XBOX';
    if (s.includes('dualsense') || s.includes('dualshock') || s.includes('playstation') || s.includes('054c')) return 'MANDO PLAYSTATION';
    if (s.includes('pro controller') || s.includes('057e')) return 'MANDO SWITCH PRO';
    return 'MANDO';
  }
  const usingPad = () => pad.connected();
  function openPadConfig() {
    if (G.mode === 'padcfg') { pad.cancelConfig(); G.mode = G.cfgReturn; return; }
    if (G.mode === 'play') G.mode = 'pause';
    if (!['title', 'pause'].includes(G.mode)) return;
    G.cfgReturn = G.mode; G.mode = 'padcfg';
    pad.configure(ok => {
      G.mode = G.cfgReturn;
      G.notice = { text: ok ? 'MANDO CONFIGURADO' : 'CONFIGURACIÓN CANCELADA', t: 150 };
    });
  }
  // textos según el control que se esté usando
  const confirmLabel = () => usingPad() ? 'PRESIONA A' : isTouch() ? 'TOCA' : 'PRESIONA ENTER';

  /* ---------------- RECURSOS ---------------- */
  const IMG = { fondos: {} };
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
  // retratos: Alfonso en cuadrícula 4×4 y Carlos en cuadrícula 4×3, de 160 px cada uno
  function drawFace(expr, x, y, size, who = 'A') { const im = who === 'C' ? IMG.carlos : IMG.alf; ctx.drawImage(im, (expr % 4) * 160, Math.floor(expr / 4) * 160, 160, 160, x, y, size, size); }
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
    // CALLE (media resolución, se escala x2) — inspirada en la Calle 6 de Circasia, Quindío
    const near = document.createElement('canvas'); near.width = LEVEL_W / 2; near.height = 270; g = near.getContext('2d');
    drawGround(g, near.width, rnd);
    const houses = [
      { w: 230, pal: 'verde', sign: 'TIENDA LA ESQUINA' }, { w: 200, pal: 'morada' }, { w: 210, pal: 'naranja', sign: 'PANADERÍA' },
      { w: 190, pal: 'aguamarina', sign: 'ARTESANÍAS' }, { w: 220, pal: 'verde' }, { w: 200, pal: 'azul', sign: 'BILLARES EL PORVENIR' },
      { w: 190, pal: 'naranja', sign: 'FONDA LA ARRIERA' }, { w: 160, pal: 'aguamarina' }, { w: 150, pal: 'azul', terrace: true },
    ];
    let x = 0;
    for (const h of houses) { drawQuindioHouse(g, x, h, rnd); x += h.w; }
    drawPremiereHouse(g, 1750, 480, rnd);
    for (const h of houses.reduce((acc, h, i) => { acc.push({ x: (acc[i - 1] ? acc[i - 1].x + houses[i - 1].w : 0), h }); return acc; }, [])) if (h.h.terrace) drawTerrace(g, h.x + 6, h.h.w - 12, rnd);
    drawPolesAndLamps(g, near.width);
    BG.near = near;
    // FINCA LA ESPERANZA (nivel 1)
    const finca = document.createElement('canvas'); finca.width = LEVEL_W / 2; finca.height = 270;
    drawFinca(finca.getContext('2d'), finca.width, mulberry(91));
    BG.nearFinca = finca;
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
  function bougainvillea(g, x, y, n, rnd) {
    for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.25 ? '#2f7a3a' : rnd() < 0.5 ? '#d42a8a' : '#ee4fa6'; g.fillRect(x + (rnd() - 0.5) * 18 | 0, y + rnd() * 26 | 0, 2, 2); }
  }
  function hangSign(g, x, y, txt, col) {
    g.font = `7px ${FONT_LOGO}`; const tw = g.measureText(txt).width + 10;
    g.fillStyle = '#4a2a18'; g.fillRect(x - tw / 2 - 1, y - 7, tw + 2, 14);
    g.fillStyle = '#f2e6c8'; g.fillRect(x - tw / 2, y - 6, tw, 12);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y + 1);
  }
  /* Casas de bahareque del Quindío: aleros de colores con canecillos, puertas de
     tableros, balcones con chambrana y zócalo con ondas. */
  const PALETTES = {
    verde: { f: '#23963f', fd: '#17702d', pa: '#d8262b', pb: '#f3c12c', under: '#f0b52a', raft: '#9a2a1c', z: '#d8262b' },
    azul: { f: '#2a63c9', fd: '#1d4793', pa: '#f3c12c', pb: '#ffffff', under: '#3a74d6', raft: '#f4f4f4', z: '#2a63c9' },
    naranja: { f: '#c2402a', fd: '#8f2c1c', pa: '#f3c12c', pb: '#23963f', under: '#e8742a', raft: '#5a2a14', z: '#23963f' },
    morada: { f: '#6b3fa0', fd: '#4d2c75', pa: '#f3c12c', pb: '#e8473c', under: '#f0b52a', raft: '#6b3fa0', z: '#6b3fa0' },
    aguamarina: { f: '#14857f', fd: '#0e5f5b', pa: '#f08a24', pb: '#f3c12c', under: '#f3c12c', raft: '#14857f', z: '#f08a24' },
  };
  function eave(g, x, y, w, P) {
    roof(g, x, y, w);
    g.fillStyle = P.under; g.fillRect(x - 6, y + 2, w + 12, 11);
    for (let cx = x - 4; cx < x + w + 4; cx += 7) { g.fillStyle = P.raft; g.fillRect(cx, y + 2, 3, 11); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx + 3, y + 3, 1, 10); }
    g.fillStyle = 'rgba(40,20,10,0.3)'; g.fillRect(x - 6, y + 13, w + 12, 2);
  }
  // hoja de puerta o postigo con cuadrícula de tableros
  function panels(g, x, y, w, h, cols, rows, P) {
    g.fillStyle = P.f; g.fillRect(x, y, w, h);
    const cw = (w - 2) / cols, rh = (h - 2) / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const px = Math.round(x + 1 + c * cw + 1), py = Math.round(y + 1 + r * rh + 1), pw = Math.max(2, Math.round(cw - 2)), ph = Math.max(2, Math.round(rh - 2));
      g.fillStyle = P.pb; g.fillRect(px, py, pw, ph);
      g.fillStyle = P.pa; if (pw > 2 && ph > 2) g.fillRect(px + 1, py + 1, pw - 2, ph - 2);
    }
    g.fillStyle = P.fd; g.fillRect(x + w - 1, y, 1, h);
  }
  function quindioDoor(g, x, y, w, h, P) {
    g.fillStyle = P.fd; g.fillRect(x - 3, y - 3, w + 6, h + 3);
    g.fillStyle = P.f; g.fillRect(x - 2, y - 2, w + 4, h + 2);
    const lw = (w - 1) / 2;
    panels(g, x, y, Math.floor(lw), h, 2, 5, P); panels(g, Math.ceil(x + lw + 1), y, Math.floor(lw), h, 2, 5, P);
    g.fillStyle = '#2a1a10'; g.fillRect(Math.round(x + w / 2), y, 1, h);
  }
  function quindioWindow(g, x, y, w, h, P) {
    g.fillStyle = P.fd; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = P.f; g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#3a2418'; g.fillRect(x, y, w, h);
    const lw = Math.floor(w / 2) - 1;
    panels(g, x, y, lw, h, 1, 3, P); panels(g, x + w - lw, y, lw, h, 1, 3, P);
    g.fillStyle = '#ffd88a'; g.fillRect(x + lw + 1, y + 2, w - lw * 2 - 2, h - 4);
    // chambrana (baranda del balcón)
    const by = y + h - 9;
    g.fillStyle = P.fd; g.fillRect(x - 4, by - 1, w + 8, 12);
    g.fillStyle = P.pa; g.fillRect(x - 3, by, w + 6, 10);
    for (let bx = x - 2; bx < x + w + 3; bx += 3) { g.fillStyle = P.pb; g.fillRect(bx, by + 2, 1, 7); }
    g.fillStyle = P.f; g.fillRect(x - 4, by - 2, w + 8, 2); g.fillRect(x - 4, by + 10, w + 8, 2);
  }
  function zocalo(g, x, w, P) {
    g.fillStyle = P.z; g.fillRect(x, 138, w, 10);
    for (let cx = x + 5; cx < x + w; cx += 10) { g.beginPath(); g.arc(cx, 138, 5, Math.PI, 0); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, 146, w, 2);
  }
  function drawQuindioHouse(g, x, h, rnd) {
    const P = PALETTES[h.pal], w = h.w, top = 28 + (rnd() * 6 | 0);
    wallTex(g, x, top, w, 150 - top, rnd, '#f6f3ec');
    g.fillStyle = 'rgba(120,100,70,0.25)'; g.fillRect(x + w - 1, top, 1, 150 - top);
    // segundo piso: ventanas con balcón
    const nWin = Math.max(2, Math.floor((w - 20) / 50));
    const gap = (w - nWin * 26) / (nWin + 1);
    for (let i = 0; i < nWin; i++) quindioWindow(g, Math.round(x + gap + i * (26 + gap)), top + 20, 26, 30, P);
    // franja entre pisos
    g.fillStyle = P.f; g.fillRect(x, 80, w, 2);
    // primer piso: puertas de tableros
    const nDoor = Math.max(2, Math.floor((w - 16) / 46));
    const dgap = (w - nDoor * 32) / (nDoor + 1);
    for (let i = 0; i < nDoor; i++) quindioDoor(g, Math.round(x + dgap + i * (32 + dgap)), 88, 32, 50, P);
    zocalo(g, x, w, P);
    eave(g, x, top, w, P);
    // bajante de agua
    g.fillStyle = '#b8322a'; g.fillRect(x + 3, top + 12, 2, 136 - top);
    if (h.sign) hangSign(g, Math.round(x + dgap + 16), 80, h.sign, P.fd);
    if (rnd() < 0.5) { g.fillStyle = '#b5552f'; g.fillRect(x + w - 18, 140, 10, 8); bougainvillea(g, x + w - 13, 124, 30, rnd); }
  }
  // Casa del Café Premier: verde y roja, con el letrero en el segundo piso
  function drawPremiereHouse(g, x, w, rnd) {
    const P = PALETTES.verde, top = 6;
    wallTex(g, x, top, w, 150 - top, rnd, '#f6f3ec');
    const mid = x + w / 2;
    for (const wx of [x + 22, x + 78, x + 134, mid + 62, mid + 118, mid + 174]) quindioWindow(g, Math.round(wx), top + 26, 28, 40, P);
    g.fillStyle = P.f; g.fillRect(x, top + 80, w, 2);
    // marco para el letrero (el logo se dibuja encima desde drawWorld)
    g.fillStyle = '#2a1a10'; g.fillRect(Math.round(mid - 42), top + 13, 84, 84);
    // puertas a lado y lado
    for (const dx of [x + 16, x + 64, x + 112, mid + 52, mid + 100, mid + 148, mid + 196]) if (dx + 32 < x + w - 4) quindioDoor(g, Math.round(dx), 88, 32, 50, P);
    // portón abierto con la escalera al segundo piso
    const dx = Math.round(mid - 34);
    g.fillStyle = P.fd; g.fillRect(dx - 4, 84, 76, 64); g.fillStyle = P.f; g.fillRect(dx - 3, 85, 74, 63);
    g.fillStyle = '#ffcf7a'; g.fillRect(dx, 88, 68, 50);
    g.fillStyle = '#c8873e'; for (let st = 0; st < 8; st++) g.fillRect(dx + 22 + st * 6, 134 - st * 5, 9, 2);
    panels(g, dx, 88, 10, 50, 1, 5, P); panels(g, dx + 58, 88, 10, 50, 1, 5, P);
    zocalo(g, x, w, P);
    g.fillStyle = '#ffcf7a'; g.fillRect(dx, 138, 68, 10);
    // tablero "suba al 2° piso"
    g.fillStyle = '#4a2a18'; g.fillRect(dx - 46, 112, 36, 30); g.fillStyle = '#1f2a24'; g.fillRect(dx - 44, 114, 32, 24);
    g.fillStyle = '#f2ead8'; g.font = `5px ${FONT_HUD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SUBA', dx - 28, 121); g.fillText('2° PISO', dx - 28, 130);
    g.fillStyle = '#4a2a18'; g.fillRect(dx - 36, 142, 2, 6); g.fillRect(dx - 22, 142, 2, 6);
    eave(g, x, top, w, P);
    g.fillStyle = '#b8322a'; g.fillRect(x + 3, top + 12, 2, 126); g.fillRect(x + w - 5, top + 12, 2, 126);
    for (const px of [x + 6, x + w - 18]) { g.fillStyle = '#b5552f'; g.fillRect(px, 140, 12, 8); bougainvillea(g, px + 6, 122, 34, rnd); }
  }
  // terraza con sombrillas azules sobre el andén
  function drawTerrace(g, x, w, rnd) {
    for (let ux = x + 18; ux < x + w - 10; ux += 44) {
      g.fillStyle = '#4a2a18'; g.fillRect(ux - 9, 140, 18, 2); g.fillRect(ux - 7, 142, 2, 7); g.fillRect(ux + 5, 142, 2, 7);
      for (const sx of [ux - 15, ux + 11]) { g.fillStyle = '#3a2418'; g.fillRect(sx, 136, 5, 2); g.fillRect(sx + (sx < ux ? 0 : 4), 128, 1, 9); g.fillRect(sx, 138, 1, 10); g.fillRect(sx + 4, 138, 1, 10); }
      g.fillStyle = '#d9d2c0'; g.fillRect(ux, 104, 1, 36);
      g.fillStyle = '#1d4f9e'; g.beginPath(); g.moveTo(ux - 26, 112); g.lineTo(ux, 98); g.lineTo(ux + 26, 112); g.closePath(); g.fill();
      g.fillStyle = '#2f7fd6'; g.beginPath(); g.moveTo(ux - 24, 111); g.lineTo(ux, 99); g.lineTo(ux + 4, 101); g.lineTo(ux - 16, 111); g.closePath(); g.fill();
      for (let k = -24; k < 26; k += 8) { g.fillStyle = '#1d4f9e'; g.fillRect(ux + k, 112, 6, 2); }
      g.fillStyle = '#ffffff'; g.fillRect(ux - 1, 97, 3, 2);
    }
  }
  function drawGround(g, width, rnd) {
    // andén de concreto con franjas
    g.fillStyle = '#c9c4ba'; g.fillRect(0, 148, width, 25);
    for (let tx = 0; tx < width; tx += 22) { g.fillStyle = '#b3ada2'; g.beginPath(); g.moveTo(tx, 148); g.lineTo(tx + 6, 148); g.lineTo(tx + 14, 173); g.lineTo(tx + 8, 173); g.fill(); }
    g.fillStyle = 'rgba(80,70,60,0.25)'; g.fillRect(0, 148, width, 1); g.fillRect(0, 160, width, 1);
    for (let tx = 4; tx < width; tx += 60) { g.fillStyle = 'rgba(80,70,60,0.18)'; g.fillRect(tx, 162, 8, 8); }
    // sardinel
    g.fillStyle = '#8f897f'; g.fillRect(0, 173, width, 5); g.fillStyle = '#e2ddd3'; g.fillRect(0, 173, width, 1);
    // calle de concreto estampado
    g.fillStyle = '#a9a194'; g.fillRect(0, 178, width, 92);
    let sy = 179;
    while (sy < 270) {
      const rh = 9 + (rnd() * 6 | 0);
      let sx = -(rnd() * 20 | 0);
      while (sx < width) {
        const sw = 14 + (rnd() * 14 | 0), tn = 160 + (rnd() * 26 | 0);
        g.fillStyle = `rgb(${tn},${tn - 6},${tn - 16})`; g.fillRect(sx + 1, sy + 1, sw - 1, rh - 1);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(sx + 2, sy + 1, sw - 4, 1);
        sx += sw;
      }
      sy += rh;
    }
    g.fillStyle = 'rgba(60,50,40,0.18)'; g.fillRect(0, 178, width, 3);
  }
  // postes de energía con cables y faroles curvos, como en la foto
  function drawPolesAndLamps(g, width) {
    const poles = [300, 720, 1150, 1560];
    g.strokeStyle = '#2a2622'; g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) for (const off of [0, 4, 8]) {
      g.beginPath(); g.moveTo(poles[i], 22 + off); g.quadraticCurveTo((poles[i] + poles[i + 1]) / 2, 46 + off, poles[i + 1], 22 + off); g.stroke();
    }
    g.beginPath(); g.moveTo(poles[3], 22); g.quadraticCurveTo(1700, 40, 1760, 20); g.stroke();
    for (const px of poles) {
      g.fillStyle = '#9a958c'; g.fillRect(px - 2, 14, 5, 160); g.fillStyle = '#c9c4ba'; g.fillRect(px - 2, 14, 1, 160);
      g.fillStyle = '#6b665e'; g.fillRect(px - 12, 20, 25, 3);
      g.fillStyle = '#4a4640'; for (const k of [-10, 0, 10]) g.fillRect(px + k - 1, 17, 2, 3);
    }
    for (const lx of [110, 520, 940, 1370]) {
      g.fillStyle = '#7d786f'; g.fillRect(lx, 40, 3, 134);
      g.strokeStyle = '#7d786f'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx + 1, 42); g.quadraticCurveTo(lx + 2, 26, lx + 20, 30); g.stroke();
      g.fillStyle = '#4a4640'; g.fillRect(lx + 16, 30, 12, 3); g.fillStyle = '#fff2c2'; g.fillRect(lx + 18, 33, 8, 1);
    }
    g.lineWidth = 1;
  }

  /* ---------------- FONDO: FINCA CAFETERA ---------------- */
  function coffeeBush(g, x, y, r, rnd, dark) {
    const greens = dark ? ['#1f4f2a', '#245a30', '#2b6636'] : ['#2b6a35', '#327a3c', '#3c8a45'];
    for (let i = 0; i < 9; i++) { g.fillStyle = greens[i % 3]; g.beginPath(); g.ellipse(x + (rnd() - 0.5) * r * 1.4, y - rnd() * r * 1.1, r * 0.55, r * 0.45, 0, 0, 7); g.fill(); }
    for (let i = 0; i < r * 1.2; i++) { g.fillStyle = rnd() < 0.7 ? '#c8202a' : '#f2b81c'; g.fillRect(x + (rnd() - 0.5) * r * 1.4 | 0, y - rnd() * r * 1.1 | 0, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - r * 0.7, y - 2, r * 1.4, 3);
  }
  function plantain(g, x, y, rnd) {
    g.fillStyle = '#5f7a2e'; g.fillRect(x - 2, y - 46, 5, 46); g.fillStyle = '#4c6424'; g.fillRect(x + 1, y - 46, 2, 46);
    for (let i = 0; i < 6; i++) {
      const ang = -2.9 + i * 0.55, len = 26 + rnd() * 10;
      g.save(); g.translate(x, y - 46); g.rotate(ang);
      g.fillStyle = i % 2 ? '#4f9a3a' : '#3f8a32'; g.beginPath(); g.ellipse(len / 2, 0, len / 2, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#6fb04a'; g.fillRect(2, -1, len - 4, 1);
      g.restore();
    }
    g.fillStyle = '#7a5a2a'; g.fillRect(x + 3, y - 40, 4, 8);
  }
  function guamo(g, x, y, rnd) {
    g.fillStyle = '#5a4430'; g.fillRect(x - 3, y - 90, 6, 90);
    g.fillRect(x - 18, y - 84, 18, 3); g.fillRect(x, y - 92, 20, 3);
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#2f6e34' : '#3a7f3d'; g.beginPath(); g.ellipse(x + (rnd() - 0.5) * 80, y - 96 - rnd() * 18, 20, 9, 0, 0, 7); g.fill(); }
  }
  function guaduaFence(g, x0, x1, y) {
    for (let x = x0; x < x1; x += 26) { g.fillStyle = '#b89a4a'; g.fillRect(x, y - 22, 4, 24); g.fillStyle = '#8a7234'; g.fillRect(x, y - 16, 4, 1); g.fillRect(x, y - 8, 4, 1); }
    for (const yy of [y - 18, y - 9]) { g.fillStyle = '#c9ab55'; g.fillRect(x0, yy, x1 - x0, 3); g.fillStyle = '#8a7234'; for (let x = x0 + 12; x < x1; x += 30) g.fillRect(x, yy, 1, 3); }
  }
  function zincRoof(g, x, y, w, h) {
    g.fillStyle = '#8e9aa3'; g.fillRect(x, y, w, h);
    for (let i = x; i < x + w; i += 4) { g.fillStyle = '#b4bec5'; g.fillRect(i, y, 2, h); }
    g.fillStyle = '#9a5a30'; for (let i = 0; i < 8; i++) g.fillRect(x + ((i * 37) % w), y + ((i * 13) % h), 6, 2); // óxido
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h, w, 2);
  }
  function costales(g, x, y, n) {
    for (let i = 0; i < n; i++) {
      const cx = x + (i % 4) * 15, cy = y - Math.floor(i / 4) * 10;
      g.fillStyle = '#5a4428'; g.fillRect(cx - 1, cy - 11, 16, 12); g.fillStyle = '#c9a46a'; g.fillRect(cx, cy - 10, 14, 10);
      g.fillStyle = '#a8854f'; g.fillRect(cx + 2, cy - 7, 10, 1); g.fillStyle = '#b8322a'; g.fillRect(cx + 5, cy - 5, 4, 2);
    }
  }
  function fincaHouse(g, x, w, rnd, big) {
    const P = big ? PALETTES.verde : PALETTES.naranja, top = big ? 30 : 64;
    wallTex(g, x, top, w, 128 - top, rnd, '#f6f1e2');
    // corredor con chambrana en el segundo piso (casona) o en la fachada (casa)
    if (big) {
      for (let wx = x + 20; wx < x + w - 40; wx += 56) quindioWindow(g, wx, top + 18, 26, 30, P);
      g.fillStyle = P.f; g.fillRect(x, top + 58, w, 2);
    }
    const nD = Math.max(2, Math.floor((w - 20) / 52));
    for (let i = 0; i < nD; i++) quindioDoor(g, Math.round(x + 14 + i * ((w - 28) / nD) + 6), 86, 30, 42, P);
    // corredor de piso: barandas de madera
    g.fillStyle = '#6b3f22'; g.fillRect(x - 6, 126, w + 12, 4);
    for (let bx = x - 4; bx < x + w + 6; bx += 6) { g.fillStyle = P.pa; g.fillRect(bx, 130, 3, 14); }
    g.fillStyle = P.f; g.fillRect(x - 6, 130, w + 12, 2); g.fillRect(x - 6, 143, w + 12, 2);
    for (const px of [x - 4, x + w / 2 - 2, x + w + 2]) { g.fillStyle = '#5a3a24'; g.fillRect(px, top + 4, 4, 140 - top); }
    eave(g, x - 8, top, w + 16, P);
    // matas colgantes en el corredor
    for (let hx = x + 20; hx < x + w - 10; hx += 48) { g.fillStyle = '#7a5a2a'; g.fillRect(hx, top + 14, 1, 10); g.fillStyle = '#b5552f'; g.fillRect(hx - 4, top + 24, 9, 6); bougainvillea(g, hx, top + 26, 18, rnd); }
  }
  function willys(g, x, y) {
    // el yipao cargado de costales
    g.fillStyle = '#1d1a18'; g.beginPath(); g.arc(x + 14, y - 8, 9, 0, 7); g.arc(x + 62, y - 8, 9, 0, 7); g.fill();
    g.fillStyle = '#6b6b6b'; g.beginPath(); g.arc(x + 14, y - 8, 4, 0, 7); g.arc(x + 62, y - 8, 4, 0, 7); g.fill();
    g.fillStyle = '#2f6e5a'; g.fillRect(x, y - 26, 78, 14); g.fillRect(x + 50, y - 34, 26, 10);
    g.fillStyle = '#245746'; g.fillRect(x, y - 14, 78, 3);
    g.fillStyle = '#9ad0e6'; g.fillRect(x + 56, y - 46, 14, 12); g.fillStyle = '#245746'; g.fillRect(x + 54, y - 48, 2, 16);
    g.fillStyle = '#d9d2c0'; g.fillRect(x + 76, y - 24, 4, 6);
    costales(g, x + 2, y - 26, 8);
  }
  function drawFinca(g, width, rnd) {
    // ladera con cafetal al fondo
    g.fillStyle = '#3d7a40'; g.fillRect(0, 60, width, 90);
    for (let row = 0; row < 4; row++) {
      const yy = 74 + row * 20, r = 8 + row * 2.5;
      for (let x = (row % 2) * 12; x < width; x += 24 + row * 4) coffeeBush(g, x + rnd() * 6, yy, r, rnd, row < 2);
    }
    for (let x = 60; x < width - 40; x += 210 + (rnd() * 60 | 0)) guamo(g, x, 120, rnd);
    for (let x = 30; x < width; x += 120 + (rnd() * 70 | 0)) plantain(g, x, 136, rnd);
    // construcciones de la finca
    fincaHouse(g, 150, 190, rnd, false);
    // beneficiadero: techo de zinc sobre postes, tolva y costales
    zincRoof(g, 640, 70, 150, 8);
    for (const px of [646, 712, 780]) { g.fillStyle = '#5a3a24'; g.fillRect(px, 78, 5, 70); }
    g.fillStyle = '#8a8f94'; g.beginPath(); g.moveTo(670, 84); g.lineTo(710, 84); g.lineTo(698, 112); g.lineTo(682, 112); g.fill();
    g.fillStyle = '#6b6f73'; g.fillRect(684, 112, 12, 22); g.fillStyle = '#4a7ab0'; g.fillRect(720, 110, 40, 30); g.fillStyle = '#3a5f8a'; g.fillRect(720, 110, 40, 3);
    costales(g, 655, 146, 7);
    hangSign(g, 715, 98, 'BENEFICIADERO', '#2f6e34');
    willys(g, 1060, 148);
    // elba: secadero con techo corredizo
    g.fillStyle = '#5a3a24'; for (const px of [1380, 1450, 1520, 1590]) g.fillRect(px, 96, 4, 50);
    g.fillStyle = '#7a5a3a'; g.fillRect(1376, 112, 222, 6);
    for (let i = 0; i < 70; i++) { g.fillStyle = rnd() < 0.5 ? '#6a3e1e' : '#8a5a2a'; g.fillRect(1378 + rnd() * 218 | 0, 110 + (rnd() * 3 | 0), 2, 2); }
    zincRoof(g, 1370, 86, 236, 7);
    // casona de la finca (escenario del jefe)
    fincaHouse(g, 1780, 420, rnd, true);
    hangSign(g, 1990, 84, 'FINCA LA ESPERANZA', '#8e221c');
    guaduaFence(g, 0, 140, 150); guaduaFence(g, 350, 630, 150); guaduaFence(g, 800, 1040, 150); guaduaFence(g, 1150, 1370, 150); guaduaFence(g, 1610, 1770, 150);
    // pasto
    g.fillStyle = '#4f8f3a'; g.fillRect(0, 148, width, 22);
    for (let i = 0; i < width / 2; i++) { g.fillStyle = rnd() < 0.5 ? '#5fa04a' : '#3f7a32'; g.fillRect(rnd() * width | 0, 148 + rnd() * 20 | 0, 1, 3); }
    // camino de tierra
    g.fillStyle = '#9a7650'; g.fillRect(0, 168, width, 102);
    g.fillStyle = '#7a5a3a'; g.fillRect(0, 168, width, 3);
    for (let i = 0; i < width * 1.2; i++) { const tn = rnd(); g.fillStyle = tn < 0.4 ? '#8a6844' : tn < 0.8 ? '#a8845c' : '#b8966a'; g.fillRect(rnd() * width | 0, 171 + rnd() * 99 | 0, 2 + (rnd() * 3 | 0), 1); }
    // huellas de llantas y piedras
    for (const yy of [196, 236]) { g.fillStyle = 'rgba(70,50,30,0.25)'; g.fillRect(0, yy, width, 5); g.fillStyle = 'rgba(255,240,210,0.08)'; g.fillRect(0, yy + 5, width, 1); }
    for (let i = 0; i < 160; i++) { const x = rnd() * width, y = 175 + rnd() * 92, r = 1.5 + rnd() * 3; g.fillStyle = '#6f6458'; g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, 7); g.fill(); g.fillStyle = '#9a8f80'; g.fillRect(x - r * 0.6, y - r * 0.6, r, 1); }
    for (let i = 0; i < 90; i++) { const x = rnd() * width, y = 172 + rnd() * 96; g.fillStyle = '#4f8f3a'; g.fillRect(x, y - 3, 1, 3); g.fillRect(x + 2, y - 4, 1, 4); g.fillRect(x + 4, y - 2, 1, 2); }
    // patio de secado frente a la casona: cemento con café extendido
    g.fillStyle = '#b9b2a4'; g.fillRect(1760, 172, 470, 98);
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(80,70,60,0.25)'; g.fillRect(1760 + i * 54, 172, 1, 98); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.55 ? '#6a3e1e' : rnd() < 0.5 ? '#8a5a2a' : '#4a2a14'; g.fillRect(1764 + rnd() * 462 | 0, 180 + rnd() * 86 | 0, 2, 1); }
    g.fillStyle = '#7a5a3a'; g.fillRect(1760, 172, 470, 2);
    // rastrillo de madera apoyado
    g.fillStyle = '#6b4a2a'; g.fillRect(1772, 120, 2, 52); g.fillRect(1764, 120, 18, 3);
  }

  /* ---------------- ESTADO DEL JUEGO ---------------- */
  const G = { mode: 'loading', t: 0, camX: 0, shake: 0, hitstop: 0, ents: [], fx: [], score: 0, lives: 3, lock: null, toast: null, dialog: null, bossOn: false, banner: null };
  let P = null;
  let attackTokens = 0;
  G.levelIdx = 0; G.lastInput = 0;
  const LV = () => LEVELS[G.levelIdx];

  function newPlayer() {
    return { kind: 'player', x: 160, y: 430, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: 100, maxhp: 100, meter: 40, st: 'idle', t: 0, fi: 0, atk: null, combo: 0, comboT: 0, invuln: 90, hitSet: null, queued: false };
  }
  function resetLevel(keepScore) {
    G.ents = []; G.fx = []; G.camX = 0; G.lock = null; G.bossOn = false; G.toast = null; G.banner = { text: LV().name, t: 150 };
    if (!keepScore) { G.score = 0; G.lives = 3; }
    const meter = P && keepScore ? P.meter : 40;
    P = newPlayer(); P.meter = meter; G.ents.push(P);
    for (const [x, y, look, drop] of LV().props) G.ents.push({ kind: 'prop', look, x, y, z: 0, hp: 1, drop, t: 0, face: 1 });
    G.nextWave = 0; G.bossDone = false; attackTokens = 0; G.boss = null; G.go = 0;
  }
  // arranca un nivel con su diálogo de entrada
  function startLevel(i, keepScore) {
    G.levelIdx = i; resetLevel(keepScore); G.mode = 'story'; setMusic('intro');
    openDialog(LV().intro, () => { G.mode = 'play'; setMusic(LV().music); });
  }
  function continueFromCheckpoint() {
    G.lives = 3; P.hp = P.maxhp; P.st = 'idle'; P.invuln = 150; P.z = 0; P.meter = Math.max(P.meter, 50);
    P.x = G.camX + 200; P.y = 430;
    for (const e of G.ents) if (e.kind === 'enemy' && e.st === 'cheer') { e.st = 'think'; e.t = 0; }
    G.mode = 'play'; setMusic(G.bossOn ? 'boss' : LV().music);
  }

  /* ---------------- DIÁLOGOS ---------------- */
  function openDialog(lines, onEnd) { G.dialog = { lines, i: 0, chars: 0, onEnd }; G.prevMode = G.mode; G.mode = 'dialog'; }
  function updDialog() {
    const D = G.dialog, line = D.lines[D.i][2];
    if (D.chars < line.length) { D.chars += 0.9; if ((G.t & 3) === 0) SFX.blip(); if (confirmPressed()) D.chars = line.length; return; }
    if (confirmPressed()) {
      SFX.select(); D.i++; D.chars = 0;
      if (D.i >= D.lines.length) { G.dialog = null; G.mode = G.prevMode === 'dialog' ? 'play' : G.prevMode; D.onEnd && D.onEnd(); }
    }
  }
  function toast(line) { G.toast = { who: line[0], expr: line[1], text: line[2], t: 260 }; }

  /* ---------------- JUGADOR ---------------- */
  const ATK = {
    jab1: { seq: [['punch', 0, 3], ['punch', 1, 4], ['punch', 2, 4], ['punch', 3, 4]], act: [1, 2], reach: 92, dmg: 6, kb: 2.5 },
    jab2: { seq: [['punch', 3, 3], ['punch', 2, 4], ['punch', 1, 4], ['punch', 4, 5]], act: [1, 2], reach: 92, dmg: 7, kb: 3 },
    fin: { seq: [['kick', 0, 3], ['kick', 1, 4], ['kick', 3, 5], ['kick', 3, 5], ['kick', 4, 6], ['kick', 5, 5]], act: [2, 3], reach: 118, dmg: 13, kb: 6, kd: true, heavy: true },
    kick: { seq: [['kick', 1, 4], ['kick', 2, 4], ['kick', 2, 6], ['kick', 4, 6]], act: [1, 2], reach: 112, dmg: 10, kb: 7 },
    low: { seq: [['crouch', 0, 3], ['crouch', 3, 4], ['crouch', 3, 5], ['crouch', 1, 4]], act: [1, 2], reach: 96, dmg: 7, kb: 2.5 },
    sweep: { seq: [['crouch', 1, 4], ['kick', 2, 10], ['kick', 4, 6]], act: [1], reach: 112, dmg: 9, kb: 4, kd: true, heavy: true },
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
      else { const dx = (e.x - P.x) * P.face; const wd = e.T && e.T.wide; ok = dx > -12 && dx < A.reach + (e.big ? 30 : wd ? 14 : 0) && Math.abs(e.y - P.y) < (e.big ? 34 : wd ? 30 : 26); }
      if (ok) { P.hitSet.add(e); damage(e, A.dmg, A.kb * (A.radius ? sign(e.x - P.x) : P.face), A.kd, A.heavy); }
    }
  }
  function hurtPlayer(dmg, dir, kd) {
    if (P.invuln > 0 || ['dying', 'knock', 'downed', 'win'].includes(P.st)) return false;
    if (P.st === 'attack' && P.atk === 'special') return false;
    P.hp = Math.max(0, P.hp - dmg); P.meter = Math.min(100, P.meter + 6); SFX.hurt(); pad.rumble(kd ? 0.9 : 0.45, 0.6, kd ? 280 : 140); G.shake = Math.max(G.shake, kd ? 7 : 4);
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
      openDialog(GAME_OVER_LINES, () => { G.mode = 'gameover'; G.t2 = 0; });
    }
  }

  /* ---------------- ESBIRROS ---------------- */
  // Cada esbirro usa una hoja estándar: idle, walk, crouch, jump, punch, kick, special, hurt, win.
  const ENEMY_TYPES = {
    machete: { sheet: 'machete', hp: 48, speed: 1.7, dmg: 9, score: 200, ai: 'melee', reach: 104, atks: ['slash', 'punch', 'slash'] },
    cuchillos: { sheet: 'cuchillos', hp: 40, speed: 2.0, dmg: 8, score: 250, ai: 'thrower', reach: 100, atks: ['kick'] },
    garrote: { sheet: 'garrote', hp: 84, speed: 1.3, dmg: 12, score: 350, ai: 'melee', reach: 104, atks: ['punch', 'kick', 'sweep'], wide: true },
    encapuchado: { sheet: 'encapuchado', hp: 70, speed: 1.55, dmg: 11, score: 300, ai: 'melee', reach: 100, atks: ['punch', 'kick', 'charge'], wide: true },
  };
  // ataques de esbirros: cuadros de preparación y de golpe dentro de la fila indicada
  const ENEMY_ATK = {
    punch: { anim: 'punch', wind: 1, strike: [2, 3, 4], windT: 18, hit: [3, 11], recT: 24, reachAdd: 0, dmg: 1 },
    kick: { anim: 'kick', wind: 1, strike: [2, 3, 3, 4], windT: 20, hit: [6, 14], recT: 28, reachAdd: 18, dmg: 1.1 },
    slash: { anim: 'special', wind: 1, strike: [2, 3, 4], windT: 24, hit: [4, 12], recT: 30, reachAdd: 22, dmg: 1.3, kd: true },
    pound: { anim: 'special', wind: 1, strike: [2, 3, 3, 4], windT: 30, hit: [2, 8], recT: 38, area: 118, dmg: 1.3, kd: true },
    charge: { anim: 'special', wind: 1, strike: [2, 3], windT: 24, dash: 9, dmg: 1.2, kd: true },
    sweep: { anim: 'special', wind: 0, strike: [1, 2, 3, 4], windT: 26, hit: [6, 16], recT: 36, reachAdd: 44, dmg: 1.3, kd: true },
  };
  function spawnEnemy(spec, side) {
    const drop = spec.endsWith('!'), type = spec.replace('!', ''), T = ENEMY_TYPES[type];
    let x = side < 0 ? G.camX - 70 : G.camX + W + 70, y = rand(FLOOR_TOP + 10, FLOOR_BOT - 10), z = 0, st = 'enter';
    if (drop) { x = clamp(P.x + side * rand(180, 300), G.camX + 80, G.camX + W - 80); y = FLOOR_TOP + rand(0, 20); z = 230; st = 'drop'; }
    const e = { kind: 'enemy', off: rand(0, 40), lane: (Math.random() * 3 | 0) - 1, type, T, x, y, z, vx: 0, vy: 0, vz: 0, face: -side, hp: T.hp, maxhp: T.hp, st, t: 0, cd: rand(30, 90), flash: 0, invuln: 0, token: false, hits: 0, walk: 0, atk: 'punch' };
    G.ents.push(e); return e;
  }
  function releaseToken(e) { if (e.token) { e.token = false; attackTokens--; } }
  function knockback(e, vx) { releaseToken(e); e.st = 'air'; e.vz = 5.5; e.vx = vx; e.z = Math.max(1, e.z); e.t = 0; }
  function damage(e, dmg, kb, kd, heavy) {
    if (e.kind === 'prop') { breakProp(e); return; }
    e.hp -= dmg; e.flash = 6; G.hitstop = heavy ? 6 : 4; G.shake = Math.max(G.shake, heavy ? 6 : 3);
    P.meter = Math.min(100, P.meter + (e.big ? 3 : 7));
    G.score += 10 * dmg; (heavy ? SFX.heavy : SFX.hit)(); pad.rumble(heavy ? 0.5 : 0.12, heavy ? 0.45 : 0.3, heavy ? 120 : 60);
    sparks(e.x, e.y - (e.big ? 120 : e.T.wide ? 95 : 80), heavy ? '#f7e04a' : '#ffffff', heavy ? 12 : 7);
    if (e.big) { bossHit(e, dmg, kb, kd); return; }
    releaseToken(e); e.hits++;
    // los gordos aguantan más golpes antes de caer
    if (e.hp <= 0 || kd || e.hits >= (e.T.wide ? 5 : 4)) { e.hits = 0; knockback(e, kb || sign(e.x - P.x) * 5); }
    else { e.st = 'hurt'; e.t = 0; e.vx = kb * (e.T.wide ? 0.5 : 0.8); e.face = -sign(kb || 1); e.hurtF = (Math.random() * 3) | 0; }
  }
  function pickAttack(e, dist) {
    const opts = e.T.atks.filter(a => a !== 'charge' || dist > 150);
    return opts[(Math.random() * opts.length) | 0] || 'punch';
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
      case 'drop': e.z -= 7; e.face = sign(dxP); if (e.z <= 0) { e.z = 0; e.st = 'land'; e.t = 0; dust(e.x, e.y); SFX.land(); G.shake = T.wide ? 6 : 3; } break;
      case 'land': if (e.t > 14) e.st = 'think'; break;
      case 'think': {
        if (e.cd > 0) e.cd--;
        e.face = sign(dxP);
        const thrower = T.ai === 'thrower' && Math.abs(dxP) > 130;
        if (!thrower) {
          // el embestida se lanza desde lejos, en el mismo carril
          if (e.cd <= 0 && !playerDown && T.atks.includes('charge') && Math.abs(dxP) > 200 && Math.abs(dyP) < 14 && Math.random() < 0.02) {
            e.atk = 'charge'; e.st = 'wind'; e.t = 0; break;
          }
          const canAtk = e.cd <= 0 && (e.token || attackTokens < 2) && !playerDown;
          const want = e.atk === 'pound' ? 70 : T.reach - 26 + (ENEMY_ATK[e.atk] ? ENEMY_ATK[e.atk].reachAdd || 0 : 0);
          const tx = P.x + side * (canAtk ? want : 150 + e.off), ty = canAtk ? P.y : P.y + e.lane * 40;
          moveToward(e, tx - e.x, ty - e.y, T.speed);
          if (canAtk && Math.abs(tx - e.x) < 10 && Math.abs(dyP) < 10) {
            if (!e.token) { e.token = true; attackTokens++; }
            e.atk = pickAttack(e, Math.abs(dxP)); if (e.atk === 'charge') e.atk = 'punch';
            e.st = 'wind'; e.t = 0;
          }
        } else {
          const tx = clamp(P.x + side * 280, G.camX + 50, G.camX + W - 50);
          moveToward(e, tx - e.x, P.y - e.y, T.speed);
          if (e.cd <= 0 && !playerDown && Math.abs(dyP) < 12 && Math.abs(dxP) > 170) { e.st = 'throwW'; e.t = 0; e.face = sign(dxP); }
        }
        break;
      }
      case 'wind': {
        const A = ENEMY_ATK[e.atk];
        if (e.t > A.windT) { e.t = 0; e.didHit = false; SFX.whoosh(); if (A.dash) { e.st = 'dash'; e.vx = e.face * A.dash; } else e.st = 'strike'; }
        break;
      }
      case 'strike': {
        const A = ENEMY_ATK[e.atk];
        if (e.t >= A.hit[0] && e.t <= A.hit[1] && !e.didHit) {
          if (A.area) {
            if (e.t === A.hit[0]) { G.shake = 9; SFX.crash(); spawnRing(e.x, e.y); dust(e.x - 40, e.y); dust(e.x + 40, e.y); }
            if (Math.abs(P.x - e.x) < A.area && Math.abs(P.y - e.y) < 34 && P.z < 30) { e.didHit = true; hurtPlayer(Math.round(T.dmg * A.dmg), sign(P.x - e.x), true); }
          } else {
            const dx = (P.x - e.x) * e.face;
            if (dx > -5 && dx < T.reach + (A.reachAdd || 0) && Math.abs(P.y - e.y) < 22 && P.z < 50) { e.didHit = true; hurtPlayer(Math.round(T.dmg * A.dmg), e.face, !!A.kd); }
          }
        }
        if (e.t > A.recT) { e.st = 'think'; e.cd = rand(50, 110); releaseToken(e); }
        break;
      }
      case 'dash': {
        const A = ENEMY_ATK[e.atk];
        e.x += e.vx;
        if (e.t % 3 === 0) G.fx.push({ k: 'after', sheet: T.sheet, a: A.anim, i: A.strike[0], x: e.x, y: e.y, face: e.face, scale: 1, t: 12 });
        if (!e.didHit && Math.abs(P.x - e.x) < 60 && Math.abs(P.y - e.y) < 22 && P.z < 50) { e.didHit = true; hurtPlayer(Math.round(T.dmg * A.dmg), e.face, true); }
        if (e.t > 46 || e.x < G.camX + 30 || e.x > G.camX + W - 30) { e.st = 'think'; e.cd = rand(120, 180); e.vx = 0; releaseToken(e); }
        break;
      }
      case 'throwW': if (e.t > 22) {
        e.st = 'throwR'; e.t = 0; SFX.throw();
        G.ents.push({ kind: 'proj', proj: 'knife', x: e.x + e.face * 40, y: e.y, z: 74, vx: e.face * 8, dmg: T.dmg, t: 0, spin: 0 });
      } break;
      case 'throwR': if (e.t > 22) { e.st = 'think'; e.cd = rand(100, 160); } break;
      case 'hurt': e.x += e.vx; e.vx *= 0.8; if (e.t > 16) { e.st = 'think'; e.cd = Math.max(e.cd, 25); } break;
      case 'air': e.x += e.vx; e.z += e.vz; e.vz -= 0.45; if (e.z <= 0) { e.z = 0; e.vx *= 0.3; e.st = 'down'; e.t = 0; dust(e.x, e.y); SFX.land(); if (T.wide) G.shake = Math.max(G.shake, 5); } break;
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
  const nFrames = (sheet, anim) => (SHEETS[sheet].meta[anim] || [0]).length;
  // [animación, cuadro, tendido]
  function minionFrame(e) {
    const T = e.T, t = e.t, nw = nFrames(T.sheet, 'walk'), ni = nFrames(T.sheet, 'idle');
    switch (e.st) {
      case 'enter': return ['walk', (e.walk / 6 | 0) % nw];
      case 'think': return e.walk ? ['walk', (e.walk / 6 | 0) % nw] : ['idle', (G.t / 9 | 0) % ni];
      case 'drop': return ['jump', e.z > 120 ? 2 : 3];
      case 'land': return ['jump', 5];
      case 'wind': { const A = ENEMY_ATK[e.atk]; return [A.anim, A.wind]; }
      case 'strike': { const A = ENEMY_ATK[e.atk]; const k = Math.min(A.strike.length - 1, Math.floor(t / (A.recT / A.strike.length))); return [A.anim, A.strike[k]]; }
      case 'dash': { const A = ENEMY_ATK[e.atk]; return [A.anim, A.strike[(t / 6 | 0) % A.strike.length]]; }
      case 'throwW': return ['special', 1];
      case 'throwR': return ['special', t < 10 ? 2 : 3];
      case 'hurt': return ['hurt', (e.hurtF || 0) + (t < 8 ? 0 : 1)];
      case 'air': return ['hurt', 3];
      case 'down': case 'dead': return ['crouch', 0, true];
      case 'getup': return ['crouch', 2];
      case 'cheer': return ['win', (G.t / 12 | 0) % nFrames(T.sheet, 'win')];
    }
    return ['idle', 0];
  }

  /* ---------------- JEFES ---------------- */
  // El Doctor Cuajada (nivel 1) y el Doctor Broca (nivel 2) comparten la misma IA;
  // cambian la hoja, el proyectil y cómo se ve cada estado.
  const BOSS_TYPES = {
    // Doctor Cuajada: científico con lanzallamas y tanques a la espalda
    cuajada: {
      sheet: 'cuajada', scale: 1.15, proj: 'fire', jabReach: 150, spinReach: 150, sfx: () => SFX.flame(),
      frames(e) {
        const t = e.t, nw = nFrames('cuajada', 'walk');
        switch (e.st) {
          case 'enter': return ['walk', (e.walk / 6 | 0) % nw];
          case 'taunt': return ['win', (t / 12 | 0) % 4];
          case 'think': return e.walk ? ['walk', (e.walk / 6 | 0) % nw] : ['idle', (G.t / 12 | 0) % 5];
          case 'jabW': return e.useKick ? ['kick', 1] : ['punch', 1];
          case 'jab': return e.useKick ? ['kick', 2] : ['punch', t < 8 ? 2 : 3];
          case 'spin': return ['special', 1 + ((t / 6 | 0) % 2)];
          case 'barrageW': return ['special', 0];
          case 'barrage': return ['special', t < 10 ? 1 : t < 20 ? 2 : 3];
          case 'dashW': return ['crouch', 0];
          case 'dash': return ['punch', 3];
          case 'leapW': return ['jump', 0];
          case 'leap': return ['jump', e.vz > 2 ? 2 : 3];
          case 'slam': return ['crouch', 1];
          case 'hurt': return ['hurt', e.hurtF || 0];
          case 'air': return ['hurt', 3];
          case 'down': case 'dying': return ['hurt', 5, true];
          case 'getup': return ['crouch', 2];
          case 'cheer': return ['win', 2];
        }
        return ['idle', 0];
      },
    },
    // Doctor Broca: guantes de acero y tanque de ácido en la espalda
    broca: {
      sheet: 'tanque', scale: 1.22, proj: 'acid', jabReach: 165, spinReach: 130, sfx: () => SFX.drill(),
      frames(e) {
        const t = e.t, nw = nFrames('tanque', 'walk');
        switch (e.st) {
          case 'enter': return ['walk', (e.walk / 6 | 0) % nw];
          case 'taunt': return ['win', (t / 14 | 0) % 3];
          case 'think': return e.walk ? ['walk', (e.walk / 6 | 0) % nw] : ['idle', (G.t / 12 | 0) % 5];
          case 'jabW': return e.useKick ? ['kick', 2] : ['punch', 1];
          case 'jab': return e.useKick ? ['kick', 3] : ['punch', t < 8 ? 2 : 3];
          case 'spin': return ['special', 2 + ((t / 8 | 0) % 2)];
          case 'barrageW': return ['special', 1];
          case 'barrage': return ['special', 2];
          case 'dashW': return ['crouch', 1];
          case 'dash': return ['punch', 2];
          case 'leapW': return ['jump', 0];
          case 'leap': return ['jump', e.vz > 2 ? 1 : 3];
          case 'slam': return ['special', 3];
          case 'hurt': return ['hurt', e.hurtF || 0];
          case 'air': return ['hurt', 3];
          case 'down': case 'dying': return ['hurt', 5, true];
          case 'getup': return ['crouch', 1];
          case 'cheer': return ['win', 1];
        }
        return ['idle', 0];
      },
    },
  };
  function spawnBoss() {
    const B = LV().boss;
    const e = { kind: 'enemy', type: B.type, BT: BOSS_TYPES[B.type], big: true, T: { score: 6000, sheet: BOSS_TYPES[B.type].sheet }, x: G.camX + W + 90, y: 430, z: 0, vx: 0, vy: 0, vz: 0, face: -1, hp: B.hp, maxhp: B.hp, st: 'enter', t: 0, cd: 50, flash: 0, invuln: 0, armor: 0, armorT: 0, phase: 1, walk: 0 };
    G.ents.push(e); G.boss = e; G.bossOn = true; setMusic('boss'); SFX.boss(); G.shake = 10;
  }
  function bossHit(e, dmg, kb, kd) {
    e.armor += kd ? 3 : 1; e.armorT = 0;
    if (e.hp <= 0) { e.hp = 0; e.st = 'air'; e.vz = 6; e.vx = sign(kb || 1) * 3; e.z = Math.max(1, e.z); G.hitstop = 14; G.shake = 14; return; }
    if (e.armor >= 9) { e.armor = 0; e.st = 'air'; e.vz = 4.5; e.vx = sign(kb || 1) * 3; e.z = Math.max(1, e.z); e.t = 0; return; }
    if (e.st === 'think' || e.st === 'taunt') { e.st = 'hurt'; e.t = 0; e.vx = kb * 0.3; e.hurtF = (Math.random() * 3) | 0; }
    if (e.phase === 1 && e.hp < e.maxhp / 2) {
      e.phase = 2; toast(LV().bossHalf);
      LV().boss.reinforce.forEach((s, i) => spawnEnemy(s, i % 2 ? 1 : -1));
    }
  }
  function updBoss(e) {
    const BT = e.BT, dxP = P.x - e.x, dyP = P.y - e.y, side = e.x < P.x ? -1 : 1, p2 = e.phase === 2, sp = p2 ? 2.2 : 1.6;
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
          e.t = 0; e.didHit = false; e.face = sign(dxP); e.useKick = Math.random() < 0.4;
          if (close) e.st = r < 0.45 ? 'jabW' : r < 0.7 ? 'spin' : r < 0.85 ? 'leapW' : 'barrageW';
          else if (Math.abs(dyP) < 24 && r < 0.35) e.st = 'dashW';
          else e.st = r < 0.6 ? 'barrageW' : 'leapW';
          if (e.st === 'spin') BT.sfx();
        }
        break;
      }
      case 'jabW': if (e.t > (p2 ? 14 : 22)) { e.st = 'jab'; e.t = 0; BT.sfx(); } break;
      case 'jab': hitBox(BT.jabReach, 32, 12, false); if (e.t > 22) { if (p2 && !e.combo2) { e.combo2 = true; e.st = 'jabW'; e.t = 10; e.didHit = false; } else { e.combo2 = false; e.st = 'think'; e.cd = rand(40, 80) / (p2 ? 1.4 : 1); } } break;
      case 'spin': {
        e.x += clamp(dxP, -2.4, 2.4); e.y += clamp(dyP, -1.4, 1.4);
        if (e.t % 16 === 0) e.didHit = false;
        if (!e.didHit && Math.abs(dxP) < BT.spinReach && Math.abs(dyP) < 34 && P.z < 60) { if (hurtPlayer(10, sign(dxP), true)) e.didHit = true; }
        if (e.t % 4 === 0) G.fx.push({ k: 'dust', x: e.x + rand(-40, 40), y: e.y, vx: rand(-2, 2), r: 6, t: 18 });
        if (e.type === 'cuajada' && e.t % 3 === 0) sparks(e.x + e.face * rand(60, 140), e.y - 95, Math.random() < 0.5 ? '#ffb02e' : '#ff5a1f', 2);
        if (e.t > (p2 ? 90 : 70)) { e.st = 'think'; e.cd = rand(50, 90); }
        break;
      }
      case 'barrageW': if (e.t > 32) {
        e.st = 'barrage'; e.t = 0; SFX.throw(); BT.sfx();
        const lanes = p2 ? [-70, -35, 0, 35, 70] : [-50, 0, 50];
        lanes.forEach((dy, i) => G.ents.push({ kind: 'proj', proj: BT.proj, x: e.x + e.face * 110, y: clamp(e.y + dy, FLOOR_TOP, FLOOR_BOT), z: 96, vx: e.face * (6 + (i % 2)), dmg: 9, t: 0, spin: rand(0, 6) }));
      } break;
      case 'barrage': if (e.t > 28) { e.st = 'think'; e.cd = rand(50, 90); } break;
      case 'dashW': if (e.t > 26) { e.st = 'dash'; e.t = 0; e.vx = e.face * 11; BT.sfx(); } break;
      case 'dash': {
        e.x += e.vx; hitBox(150, 30, 14, true, 40);
        if (e.t % 3 === 0) { const [a, i] = BT.frames(e); G.fx.push({ k: 'after', sheet: BT.sheet, a, i, x: e.x, y: e.y, face: e.face, scale: BT.scale, t: 14 }); }
        if (e.t > 50 || e.x < G.camX + 70 || e.x > G.camX + W - 70) { e.st = 'think'; e.cd = rand(40, 70); e.x = clamp(e.x, G.camX + 70, G.camX + W - 70); }
        break;
      }
      case 'leapW': if (e.t > 18) { e.st = 'leap'; e.t = 0; e.vz = 13; e.tx = P.x; e.ty = P.y; SFX.jump(); } break;
      case 'leap': {
        e.x += (e.tx - e.x) * 0.055; e.y += (e.ty - e.y) * 0.055; e.z += e.vz; e.vz -= 0.85;
        if (e.z <= 0) {
          e.z = 0; e.st = 'slam'; e.t = 0; G.shake = 12; SFX.crash(); pad.rumble(1, 0.7, 350); dust(e.x - 40, e.y); dust(e.x + 40, e.y); spawnRing(e.x, e.y);
          if (e.type === 'broca') sparks(e.x, e.y - 10, '#7dff5a', 14);
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
  function bossDefeated() {
    const L = LV();
    G.score += 6000; G.bossDone = true; SFX.ko();
    for (const e of G.ents) if (e.kind === 'enemy' && !e.big && e.st !== 'dead') { e.hp = 0; knockback(e, sign(e.x - P.x) * 5); }
    for (const p of G.ents) if (p.kind === 'proj') p.remove = true;
    setTimeout(() => {
      if (G.mode === 'title' || G.mode === 'splash') return;
      P.st = 'win'; P.t = 0; setMusic('win');
      G.banner = { text: L.victoryBanner, t: 999 };
      setTimeout(() => { if (G.mode === 'play') openDialog(L.victory, () => { G.mode = 'victory'; G.t2 = 0; }); }, 1800);
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
    const L = LV();
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

  // vuelve al menú de juegos (lo maneja React con hooks.onExit)
  function exitToMenu() { if (hooks.onExit) { SFX.select(); hooks.onExit(); } }

  /* ---------------- BUCLE PRINCIPAL ---------------- */
  function update() {
    G.t++;
    for (const k in IN.buf) if (IN.buf[k] > 0) IN.buf[k]--;
    pad.poll();
    if (G.notice && --G.notice.t <= 0) G.notice = null;
    if (consume('mute')) setMuted(!audio.isMuted());
    switch (G.mode) {
      case 'splash':
        G.t2++;
        if (consume('padcfg')) { openPadConfig(); break; }
        if (G.t2 > 20 && (confirmPressed() || consume('pause') || consume('special'))) { enterTitle(); break; }
        if (G.t - G.lastInput > CAST_IDLE && G.t2 > CAST_IDLE) startCast('splash');
        break;
      case 'title':
        G.titleT++;
        if (consume('padcfg')) { openPadConfig(); break; }
        if (G.titleT > 45 && (consume('special') || consume('exit'))) { exitToMenu(); break; }
        if (G.titleT > 45 && confirmPressed()) { SFX.select(); startLevel(0, false); break; }
        if (G.t - G.lastInput > CAST_IDLE && G.titleT > CAST_IDLE) startCast('title');
        break;
      case 'dialog': updDialog(); if (P && P.st === 'win') P.t++; break;
      case 'pause': if (consume('padcfg')) { openPadConfig(); break; } if (consume('special') || consume('exit')) { exitToMenu(); break; } if (consume('pause') || consume('start')) G.mode = 'play'; break;
      case 'padcfg': if (consume('padreset')) { pad.resetMaps(); pad.cancelConfig(); G.mode = G.cfgReturn; G.notice = { text: 'MANDO RESTABLECIDO A LOS BOTONES NORMALES', t: 180 }; break; } if (consume('special')) { pad.setRumble(!pad.rumbleEnabled()); G.notice = { text: pad.rumbleEnabled() ? 'VIBRACIÓN ACTIVADA' : 'VIBRACIÓN APAGADA', t: 120 }; } if (consume('pause') || consume('padcfg')) { pad.cancelConfig(); G.mode = G.cfgReturn; G.notice = { text: 'CONFIGURACIÓN CANCELADA', t: 120 }; } break;
      case 'gameover': G.t2++; if (G.t2 > 40 && confirmPressed()) { SFX.select(); continueFromCheckpoint(); } break;
      case 'victory': G.t2++; if (G.t2 > 60 && confirmPressed()) {
        SFX.select();
        if (G.levelIdx < LEVELS.length - 1) startLevel(G.levelIdx + 1, true);
        else { G.mode = 'title'; G.titleT = 0; G.lastInput = G.t; setMusic('intro'); }
      } break;
      case 'cast': updCast(); break;
      case 'play': {
        if (consume('padcfg')) { openPadConfig(); break; }
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
    // fondo del nivel: la panorámica de assets/fondos si existe; si no, el dibujado por código
    const pano = IMG.fondos[LV().bg];
    if (pano) {
      // la imagen se estira a todo el nivel (${LEVEL_W} × 540); el andén debe quedar al 63 % de la altura
      ctx.imageSmoothingEnabled = false;
      const k = pano.width / LEVEL_W;
      ctx.drawImage(pano, cx * k, 0, W * k, pano.height, 0, 0, W, H);
    } else ctx.drawImage(LV().bg === 'finca' ? BG.nearFinca : BG.near, cx / 2, 0, W / 2, 270, 0, 0, W, H);
    // letrero del Café Premier en el segundo piso (solo en la Calle Real)
    const lx = 3980 - cx;
    // si la panorámica ya trae el letrero pintado, no se dibuja encima
    if (LV().bg === 'calle' && !IMG.fondos.calle && lx > -200 && lx < W + 200) {
      ctx.imageSmoothingEnabled = true;
      const lw = 140, lh = lw * IMG.logo.height / IMG.logo.width, ly = 44;
      ctx.fillStyle = '#4a2a18'; ctx.fillRect(lx - lw / 2 - 6, ly - 6, lw + 12, lh + 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(lx - lw / 2 + 4, ly + lh + 6, lw, 6);
      ctx.drawImage(IMG.logo, lx - lw / 2, ly, lw, lh);
      ctx.imageSmoothingEnabled = false;
    }
    const list = G.ents.slice().sort((a, b) => a.y - b.y);
    for (const e of list) shadow(e.x - cx, e.y, e.big ? 62 : e.kind === 'pickup' ? 18 : e.kind === 'proj' ? 14 : e.T && e.T.wide ? 46 : 36);
    for (const f of G.fx) if (f.k === 'dust') { ctx.fillStyle = `rgba(120,95,70,${f.t / 40})`; ctx.beginPath(); ctx.arc(f.x - cx, f.y - 4, f.r, 0, 7); ctx.fill(); }
    ctx.imageSmoothingEnabled = true;
    for (const f of G.fx) if (f.k === 'after') drawFrame(SHEETS[f.sheet].img, SHEETS[f.sheet].meta, f.a, f.i, f.x - cx, f.y, f.face, f.scale, f.t / 30);
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
    if (s === 'jump') { if (P.airAtk) return ['kick', 3]; return ['jump', P.vz > 6 ? 1 : P.vz > 1 ? 2 : P.vz > -4 ? 3 : 4]; }
    if (s === 'land') return ['jump', 5];
    if (s === 'attack') { const st = ATK[P.atk].seq[P.fi]; return [st[0], st[1]]; }
    if (s === 'hurt') return ['hurt', P.t < 8 ? 0 : 2];
    if (s === 'knock') return ['hurt', 1];
    if (s === 'downed') return P.t < 20 ? ['crouch', 0] : ['jump', 5];
    if (s === 'dying') return ['hurt', 3 + (P.t / 10 | 0) % 4];
    if (s === 'win') { const k = P.t / 14 | 0; return ['win', k === 0 ? 3 : k === 1 ? 1 : 0]; }
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
    const flash = e.flash > 0 && e.flash % 2 === 0;
    const [a, i, lying] = e.big ? e.BT.frames(e) : minionFrame(e);
    const S = SHEETS[e.T.sheet], sc = e.big ? e.BT.scale : 1;
    ctx.imageSmoothingEnabled = true;
    if (lying) drawFrame(flash ? S.white : S.img, S.meta, a, i, x - e.face * 10, y + 8, e.face, sc, 1, -e.face * 1.35);
    else drawFrame(flash ? S.white : S.img, S.meta, a, i, x, y, e.face, sc);
    ctx.imageSmoothingEnabled = false;
    if (['wind', 'jabW', 'dashW', 'barrageW', 'leapW', 'throwW'].includes(e.st) && (G.t >> 2) % 2) {
      const yy = y - (e.big ? 200 : e.T.wide ? 175 : 150);
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
    ctx.fillStyle = '#2a1608'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = gold ? '#f7d24a' : '#7a4520'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = gold ? '#b8891c' : '#2a1608'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.quadraticCurveTo(0, -5, 12, 1); ctx.stroke();
    ctx.fillStyle = gold ? 'rgba(255,255,255,0.7)' : 'rgba(255,210,160,0.35)'; ctx.fillRect(-8, -7, 5, 2);
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
  function drawProj(p, cx) {
    const x = p.x - cx, y = p.y - p.z, rot = p.spin + p.t * 0.3;
    if (p.proj === 'cheese') {
      // bloque de cuajada envuelto en hoja de plátano
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.6);
      ctx.fillStyle = '#1d2a14'; ctx.fillRect(-19, -13, 38, 26);
      ctx.fillStyle = '#3f8f3a'; ctx.fillRect(-17, -11, 34, 22);
      ctx.fillStyle = '#fbf6e6'; ctx.fillRect(-13, -8, 26, 16);
      ctx.fillStyle = '#e8dfc2'; ctx.fillRect(-13, 4, 26, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(-10, -6, 8, 3);
      ctx.fillStyle = '#2f6b2a'; ctx.fillRect(-17, -1, 34, 2);
      ctx.restore();
    } else if (p.proj === 'knife') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.t * 0.5 * sign(p.vx));
      ctx.fillStyle = '#120818'; ctx.fillRect(-16, -4, 32, 8);
      ctx.fillStyle = '#d9dde6'; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(15, 0); ctx.lineTo(-2, 3); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -2, 10, 1);
      ctx.fillStyle = '#4a2a18'; ctx.fillRect(-14, -3, 12, 6); ctx.fillStyle = '#c9a227'; ctx.fillRect(-3, -4, 2, 8);
      ctx.restore();
    } else if (p.proj === 'fire') {
      // bola de fuego del lanzallamas
      const fl = (p.t >> 1) % 2, d = -sign(p.vx);
      for (let k = 3; k >= 0; k--) {
        const r = 15 - k * 3 + (fl ? 2 : 0);
        ctx.fillStyle = ['#ff3a12', '#ff7a1a', '#ffb02e', '#fff0a0'][3 - k];
        ctx.beginPath(); ctx.arc(x + d * k * 9, y + (k % 2 ? 2 : -2), r, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,140,40,0.25)'; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill();
    } else if (p.proj === 'acid') {
      // bola de ácido del tanque del Doctor Broca
      const r = 13 + Math.sin(p.t * 0.6) * 2;
      ctx.fillStyle = 'rgba(125,255,90,0.25)'; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#0f3a10'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#3fd83a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#b6ff8a'; ctx.fillRect(x - 5, y - 6, 5, 4); ctx.fillRect(x + 3, y + 2, 3, 3);
      for (let k = 1; k < 4; k++) { ctx.fillStyle = `rgba(63,216,58,${0.5 - k * 0.12})`; ctx.beginPath(); ctx.arc(x - sign(p.vx) * k * 12, y + k * 2, r * (1 - k * 0.2), 0, 7); ctx.fill(); }
    } else { ctx.imageSmoothingEnabled = true; drawBean(x, y, 0.75, rot, false); ctx.imageSmoothingEnabled = false; }
  }
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
    hudText('CAPITÁN PREMIER', 100, 30, 12, '#f2ead8');
    bar(100, 40, 260, 16, P.hp / P.maxhp, P.hp < 30 ? '#ff6b6b' : '#7dff8a', P.hp < 30 ? '#c2312b' : '#2f9e5a');
    const full = P.meter >= 100;
    bar(100, 66, 180, 8, P.meter / 100, full && (G.t >> 3) % 2 ? '#ffffff' : '#f7e04a', '#c98a1a');
    hudText(full ? 'ESPECIAL LISTO' : 'ESPECIAL', 292, 75, 8, full ? '#f7e04a' : '#d8cfe8');
    hudText('×' + G.lives, 370, 56, 14, '#f7e04a');
    ctx.fillStyle = 'rgba(18,8,24,0.55)'; ctx.fillRect(W - 170, 8, 162, 56);
    hudText(String(G.score).padStart(7, '0'), W - 18, 34, 16, '#ffffff', 'right');
    hudText('PUNTOS', W - 18, 54, 8, '#f2ead8', 'right');
    if (G.bossOn && G.boss && !G.bossDone) {
      hudText(LV().boss.name, W / 2, H - 46, 12, '#f7e04a', 'center');
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
  // cada narrador tiene su color de marco y su placa
  const SPEAKERS = {
    A: { name: 'ALFONSO HERNÁNDEZ MURCIA', short: 'ALFONSO', sub: 'CABINA DEL CAFÉ PREMIER', main: '#7dff8a', dim: '#2f9e5a', text: '#e8ffe9' },
    C: { name: 'CARLOS FLÓREZ', short: 'CARLOS', sub: 'ASESOR NO OFICIAL', main: '#f7d01c', dim: '#a8861a', text: '#fff6d8' },
  };
  function drawToast() {
    const T = G.toast, SP = SPEAKERS[T.who] || SPEAKERS.A, a = Math.min(1, T.t / 20, (260 - T.t) / 12);
    ctx.save(); ctx.globalAlpha = a;
    const x = 16, y = H - 130, w = 470;
    ctx.fillStyle = 'rgba(12,8,22,0.9)'; ctx.fillRect(x, y, w, 100); ctx.strokeStyle = SP.main; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, 98);
    crtFrame(x + 14, y + 14, 72); drawFace(T.expr, x + 14, y + 14, 72, T.who);
    ctx.fillStyle = BG.scan; ctx.fillRect(x + 14, y + 14, 72, 72);
    ctx.font = `10px ${FONT_HUD}`; ctx.fillStyle = SP.main; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(SP.short, x + 104, y + 28);
    ctx.font = `26px ${FONT_TXT}`; ctx.fillStyle = '#f2ead8';
    wrap(T.text, w - 120).forEach((l, i) => ctx.fillText(l, x + 104, y + 54 + i * 22));
    ctx.restore();
  }
  function drawDialog() {
    const D = G.dialog; if (!D) return;
    const [who, expr, text] = D.lines[D.i], SP = SPEAKERS[who] || SPEAKERS.A;
    ctx.fillStyle = 'rgba(6,3,14,0.5)'; ctx.fillRect(0, 0, W, H);
    const x = 30, y = H - 196, w = W - 60, h = 176;
    ctx.fillStyle = '#0c0816'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = SP.main; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = SP.dim; ctx.lineWidth = 1; ctx.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
    const ps = 140, talking = D.chars < text.length && (G.t >> 3) % 2;
    // Carlos rebota un poco al hablar; Alfonso mueve la boca
    const bob = who === 'C' && talking ? -3 : 0;
    crtFrame(x + 18, y + 18, ps);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 18, ps, ps); ctx.clip();
    if (who === 'C') drawFace(expr, x + 18, y + 18 + bob, ps, 'C');
    else drawFace(talking && expr !== 15 ? [1, 0, 3, 1][expr % 4] : expr, x + 18, y + 18, ps, 'A');
    ctx.restore();
    ctx.fillStyle = BG.scan; ctx.fillRect(x + 18, y + 18, ps, ps);
    ctx.fillStyle = 'rgba(125,255,138,0.06)'; ctx.fillRect(x + 18, y + 18 + ((G.t * 2) % ps), ps, 6);
    ctx.font = `12px ${FONT_HUD}`; ctx.fillStyle = SP.main; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(SP.name, x + 184, y + 38);
    ctx.font = `9px ${FONT_HUD}`; ctx.fillStyle = SP.dim; ctx.fillText(SP.sub, x + 184, y + 56);
    ctx.font = `32px ${FONT_TXT}`; ctx.fillStyle = SP.text;
    const shown = text.slice(0, Math.floor(D.chars));
    wrap(text, w - 210).reduce((acc, l, i) => { ctx.fillText(shown.slice(acc, acc + l.length), x + 184, y + 94 + i * 30); return acc + l.length + 1; }, 0);
    if (D.chars >= text.length && (G.t >> 4) % 2) { ctx.font = `10px ${FONT_HUD}`; ctx.fillStyle = SP.main; ctx.textAlign = 'right'; ctx.fillText('CONTINUAR ▼', x + w - 22, y + h - 18); }
    ctx.font = `8px ${FONT_HUD}`; ctx.fillStyle = SP.dim; ctx.textAlign = 'right'; ctx.fillText(`${D.i + 1}/${D.lines.length}`, x + w - 22, y + 30);
  }
  // luciérnagas de la escena de inicio
  const FIREFLIES = Array.from({ length: 26 }, (_, i) => ({ x: 420 + ((i * 137) % 540), y: 250 + ((i * 89) % 260), p: i * 0.7, s: 0.4 + (i % 5) * 0.12 }));
  let logoCanvas = null;
  function logoLayer(w, h) {
    const cw = Math.round(w), ch = Math.round(h);
    if (!logoCanvas || logoCanvas.width !== cw || logoCanvas.height !== ch) { logoCanvas = document.createElement('canvas'); logoCanvas.width = cw; logoCanvas.height = ch; }
    return logoCanvas;
  }
  function drawLogo(cx, top, w, t) {
    const h = w * IMG.logoT.height / IMG.logoT.width;
    // cae desde arriba y rebota al llegar
    const k = Math.min(1, t / 36), ease = 1 - Math.pow(1 - k, 3);
    const bounce = k < 1 ? 0 : Math.sin(Math.min(1, (t - 36) / 18) * Math.PI) * 6 * Math.max(0, 1 - (t - 36) / 18);
    const y = top - (1 - ease) * (top + h + 40) + bounce + Math.sin(G.t / 40) * 3;
    // el logo con un brillo que lo recorre solo sobre las letras
    const L = logoLayer(w, h), lg = L.getContext('2d');
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, L.width, L.height);
    lg.imageSmoothingEnabled = true; lg.drawImage(IMG.logoT, 0, 0, L.width, L.height);
    const sweep = ((G.t % 240) / 240) * (L.width + 300) - 150;
    if (k >= 1) {
      lg.globalCompositeOperation = 'source-atop';
      const g = lg.createLinearGradient(sweep - 70, 0, sweep + 70, L.height * 0.3);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      lg.fillStyle = g; lg.fillRect(0, 0, L.width, L.height);
    }
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(L, cx - w / 2, y, w, h);
    ctx.restore();
    return y + h;
  }
  function drawSplash() {
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2 - 20, 40, W / 2, H / 2 - 20, 520);
    g.addColorStop(0, 'rgba(46,111,183,0.35)'); g.addColorStop(1, 'rgba(5,3,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    hudText('CAFÉ PREMIER PRESENTA', W / 2, 70, 12, '#c8b8a0', 'center');
    drawLogo(W / 2, 100, 600, 60 + G.t2);
    if ((G.t >> 5) % 2) hudText(isTouch() ? 'TOCA PARA EMPEZAR' : usingPad() ? 'PRESIONA CUALQUIER BOTÓN' : 'PRESIONA CUALQUIER TECLA', W / 2, 470, 14, '#f2ead8', 'center');
    hudText('CON SONIDO', W / 2, 500, 8, '#7a6a5a', 'center');
  }
  function drawTitle() {
    const t = G.titleT || 0;
    // escena: paneo lento hacia arriba y acercamiento suave
    const img = IMG.intro, k = Math.min(1, t / 420), e = 1 - Math.pow(1 - k, 2);
    const zoom = 1.08 - e * 0.06, sw = img.width / zoom, sh = sw * H / W;
    const sx = (img.width - sw) * 0.35, sy = (img.height - sh) * (1 - e * 0.8);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    // luciérnagas
    for (const f of FIREFLIES) {
      const a = 0.4 + 0.6 * Math.max(0, Math.sin(G.t / 30 * f.s + f.p));
      const x = f.x + Math.sin(G.t / 90 + f.p) * 14, y = f.y + Math.cos(G.t / 70 + f.p) * 10;
      ctx.fillStyle = `rgba(255,226,120,${a * 0.25})`; ctx.fillRect(x - 3, y - 3, 7, 7);
      ctx.fillStyle = `rgba(255,240,170,${a})`; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    // logo y textos
    const bottom = drawLogo(668, 22, 470, t);
    if (t > 40) {
      ctx.globalAlpha = Math.min(1, (t - 40) / 25);
      ctx.font = `26px ${FONT_LOGO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#120818';
      const sub = 'VS DR. CUAJADA Y DR. BROCA';
      ctx.fillStyle = '#120818'; ctx.fillText(sub, 672, bottom + 34);
      ctx.strokeText(sub, 668, bottom + 30);
      ctx.fillStyle = '#9fd36a'; ctx.fillText(sub, 668, bottom + 30);
      ctx.globalAlpha = 1;
    }
    if (t > 70) {
      const band = ctx.createLinearGradient(0, 430, 0, H); band.addColorStop(0, 'rgba(5,3,10,0)'); band.addColorStop(0.35, 'rgba(5,3,10,0.7)'); band.addColorStop(1, 'rgba(5,3,10,0.9)');
      ctx.fillStyle = band; ctx.fillRect(0, 430, W, H - 430);
      if ((G.t >> 5) % 2) hudText(confirmLabel() + (usingPad() ? ' O START' : isTouch() ? ' PARA JUGAR' : ' PARA JUGAR'), W / 2, 488, 16, '#f7d01c', 'center');
      const ctrl = usingPad() ? 'X PUÑO · Y PATADA · A SALTO · B ESPECIAL · START PAUSA'
        : isTouch() ? '' : 'FLECHAS MOVER · J PUÑO · K PATADA · ESPACIO SALTO · I ESPECIAL · P PAUSA';
      if (ctrl) hudText(ctrl, W / 2, 522, 8, '#e8dcc8', 'center');
      if (hooks.onExit && !isTouch()) hudText(usingPad() ? '< B: MENÚ DE JUEGOS' : '< RETROCESO: MENÚ DE JUEGOS', 20, 28, 8, '#c8b8a0');
      if (!audio.isRunning()) hudText('HAZ CLIC O TOCA LA PANTALLA PARA ACTIVAR LA MÚSICA', W / 2, 458, 8, '#c8b8a0', 'center');
    }
    // destello al entrar
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash / 14})`; ctx.fillRect(0, 0, W, H); G.flash--; }
  }
  /* ---------------- VITRINA DE PERSONAJES ----------------
     Si nadie toca nada en la portada, se presentan los personajes uno por uno.
     Cualquier tecla, toque o botón la cierra. */
  const CAST_IDLE = 60 * 8, CAST_CARD = 60 * 6;
  function enterTitle() { audioInit(); SFX.stinger(); setMusic('intro'); G.mode = 'title'; G.titleT = 0; G.flash = 14; G.lastInput = G.t; }
  function startCast(from) { G.mode = 'cast'; G.castFrom = from; G.castI = 0; G.castT = 0; G.castStart = G.t; }
  function updCast() {
    G.castT++;
    if (G.castT >= CAST_CARD) { G.castT = 0; G.castI = (G.castI + 1) % CAST.length; }
    if (G.lastInput > G.castStart) {
      for (const k in IN.buf) IN.buf[k] = 0;
      if (G.castFrom === 'splash') enterTitle();
      else { G.mode = 'title'; G.titleT = Math.max(G.titleT, 80); G.lastInput = G.t; }
    }
  }
  function drawCast() {
    const c = CAST[G.castI], t = G.castT;
    // fondo: escena de inicio oscurecida y foco de luz
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(IMG.intro, 0, 0, IMG.intro.width, IMG.intro.width * H / W, 0, 0, W, H);
    ctx.fillStyle = 'rgba(8,4,14,0.82)'; ctx.fillRect(0, 0, W, H);
    const cxp = 270, fy = 470;
    const spot = ctx.createRadialGradient(cxp, fy - 120, 20, cxp, fy - 120, 320);
    spot.addColorStop(0, 'rgba(255,230,160,0.28)'); spot.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
    if (c.sheet) { ctx.fillStyle = 'rgba(255,220,140,0.18)'; ctx.beginPath(); ctx.ellipse(cxp, fy, 150, 26, 0, 0, 7); ctx.fill(); }
    // entrada deslizante de cada ficha
    const k = Math.min(1, t / 22), ease = 1 - Math.pow(1 - k, 3), slide = (1 - ease) * 80;
    const out = Math.max(0, (t - (CAST_CARD - 16)) / 16);
    ctx.save(); ctx.globalAlpha = Math.min(ease, 1 - out);
    if (c.sheet) {
      const S = SHEETS[c.sheet], idle = S.meta.idle[0], sc = 300 / idle[3];
      const ai = Math.floor(t / 70) % c.anims.length, anim = c.anims[ai], n = (S.meta[anim] || [0]).length;
      const fi = Math.floor(t / 8) % n;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cxp - slide, fy, 90, 16, 0, 0, 7); ctx.fill();
      drawFrame(c.silhouette ? S.dark : S.img, S.meta, anim, fi, cxp - slide, fy, 1, sc * (c.big || 1));
      if (c.silhouette) { ctx.font = `90px ${FONT_LOGO}`; ctx.textAlign = 'center'; ctx.fillStyle = '#f7d01c'; ctx.fillText('?', cxp - slide, fy - 130); }
    } else {
      // retrato en monitor
      const ps = 260, px = cxp - ps / 2 - slide, py = 150;
      const e = c.exprs[Math.floor(t / 70) % c.exprs.length];
      crtFrame(px, py, ps);
      drawFace(e, px, py, ps, c.who);
      ctx.fillStyle = BG.scan; ctx.fillRect(px, py, ps, ps);
      ctx.fillStyle = 'rgba(125,255,138,0.07)'; ctx.fillRect(px, py + ((G.t * 2) % ps), ps, 8);
    }
    // texto de la ficha
    const tx = 500 + slide;
    ctx.font = `11px ${FONT_HUD}`; const roleW = ctx.measureText(c.role).width + 24;
    ctx.fillStyle = c.color; ctx.fillRect(tx, 120, roleW, 26);
    ctx.fillStyle = '#120818'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(c.role, tx + 12, 134);
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${c.name.length > 18 ? 26 : 36}px ${FONT_LOGO}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#120818';
    const nameLines = wrap(c.name, 420);
    nameLines.forEach((l, i) => { ctx.strokeText(l, tx, 194 + i * 36); ctx.fillStyle = '#f2ead8'; ctx.fillText(l, tx, 194 + i * 36); });
    const dy = 194 + nameLines.length * 36 + 10;
    ctx.font = `28px ${FONT_TXT}`; ctx.fillStyle = '#e8dcc8';
    wrap(c.desc, 420).forEach((l, i) => ctx.fillText(l, tx, dy + i * 28));
    ctx.restore();
    // pie: avance y aviso
    CAST.forEach((_, i) => { ctx.fillStyle = i === G.castI ? '#f7d01c' : 'rgba(242,234,216,0.3)'; ctx.fillRect(W / 2 - CAST.length * 9 + i * 18, 500, 10, 10); });
    hudText('LOS PERSONAJES', 24, 44, 14, '#f7d01c');
    ctx.imageSmoothingEnabled = true;
    const lw = 150, lh = lw * IMG.logoT.height / IMG.logoT.width; ctx.drawImage(IMG.logoT, W - lw - 20, 14, lw, lh);
    if ((G.t >> 5) % 2) hudText(isTouch() ? 'TOCA PARA VOLVER' : usingPad() ? 'PRESIONA CUALQUIER BOTÓN' : 'PRESIONA CUALQUIER TECLA', W / 2, 532, 10, '#f2ead8', 'center');
  }
  function drawPadConfig() {
    const c = pad.configState(); if (!c) return;
    ctx.fillStyle = 'rgba(14,8,4,0.96)'; ctx.fillRect(0, 0, W, H);
    hudText('CONFIGURAR MANDO', W / 2, 52, 22, '#f7d01c', 'center');
    if (c.waiting) {
      hudText('PRESIONA CUALQUIER BOTÓN', W / 2, 118, 16, '#f2ead8', 'center');
      hudText('DEL MANDO QUE QUIERES CONFIGURAR', W / 2, 146, 12, '#c8b8a0', 'center');
    } else {
      hudText(`PASO ${c.step + 1} DE ${c.total}`, W / 2, 92, 10, '#c8b8a0', 'center');
      hudText('PRESIONA:', W / 2, 124, 12, '#f2ead8', 'center');
      hudText(c.label, W / 2, 166, 26, c.flash > 0 ? '#ffffff' : '#9fd36a', 'center');
    }
    // asignaciones hechas
    c.done.forEach(([l, b], i) => {
      const x = i < 5 ? 150 : 520, y = 214 + (i % 5) * 22;
      hudText(l, x, y, 9, '#f7d01c'); hudText(b, x + 170, y, 9, '#f2ead8');
    });
    // diagnóstico: lo que el navegador ve del mando
    const d = pad.diagnostics();
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(40, 338, W - 80, 140);
    hudText('LO QUE VE EL NAVEGADOR', 56, 360, 9, '#c8b8a0');
    if (!d.length) hudText('NINGÚN MANDO. CONÉCTALO Y PRESIONA UN BOTÓN.', 56, 388, 9, '#e8473c');
    d.slice(0, 3).forEach((p, i) => {
      const y = 384 + i * 36;
      ctx.font = `18px ${FONT_TXT}`; ctx.fillStyle = '#f2ead8'; ctx.textAlign = 'left';
      ctx.fillText(`${p.id.slice(0, 80)}`, 56, y);
      ctx.fillStyle = '#9fd36a';
      ctx.fillText(`${p.mapping}${p.custom ? ' · configurado' : ''}   botones: ${p.buttons.join(' ') || '—'}   ejes: ${p.axes.join(' ') || '—'}   ${p.signal}`, 56, y + 17);
    });
    hudText(isTouch() ? 'TOCA: SALTAR PASO · BOTÓN MANDO: CANCELAR' : `CLIC: SALTAR · ESC: CANCELAR · R: RESTABLECER · V: VIBRACIÓN ${pad.rumbleEnabled() ? 'SÍ' : 'NO'}`, W / 2, H - 22, 9, '#c8b8a0', 'center');
  }
  function drawNotice() {
    const n = G.notice, a = Math.min(1, n.t / 20, 1), w = Math.min(W - 40, n.text.length * 12 + 60), x = W / 2 - w / 2, y = 12;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(18,8,24,0.88)'; ctx.fillRect(x, y, w, n.sub ? 52 : 34);
    ctx.fillStyle = '#f7d01c'; ctx.fillRect(x, y, w, 3);
    hudText(n.text, W / 2, y + 24, 11, '#f7d01c', 'center');
    if (n.sub) hudText(n.sub.toUpperCase(), W / 2, y + 42, 8, '#f2ead8', 'center');
    ctx.restore();
  }
  function drawCenterPanel(title, lines, c) {
    ctx.fillStyle = 'rgba(14,8,4,0.78)'; ctx.fillRect(0, 0, W, H);
    hudText(title, W / 2, 200, 30, c, 'center');
    lines.forEach((l, i) => hudText(l, W / 2, 260 + i * 34, 14, '#f2ead8', 'center'));
  }
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    if (G.mode === 'loading') { ctx.fillStyle = '#1a0f08'; ctx.fillRect(0, 0, W, H); hudText('CARGANDO...', W / 2, H / 2, 16, '#f7d01c', 'center'); return; }
    const base = G.mode === 'padcfg' ? G.cfgReturn : G.mode;
    if (base === 'cast') drawCast();
    else if (base === 'splash') drawSplash();
    else if (base === 'title') drawTitle();
    else {
      drawWorld(); drawHUD();
      if (base === 'pause' && G.mode !== 'padcfg') drawCenterPanel('PAUSA', [usingPad() ? 'START para seguir' : 'P o ENTER para seguir', usingPad() ? 'B: volver al menú' : 'RETROCESO: volver al menú', 'M: sonido ' + (audio.isMuted() ? 'apagado' : 'encendido')], '#f7d01c');
      if (G.mode === 'gameover') drawCenterPanel('GAME OVER', ['Puntos: ' + G.score, (G.t2 > 40 && (G.t >> 4) % 2) ? confirmLabel() + ' PARA CONTINUAR' : ''], '#e8473c');
      if (G.mode === 'victory') { const last = G.levelIdx >= LEVELS.length - 1; drawCenterPanel(LV().endTitle, ['Puntos: ' + G.score, LV().endLine, (G.t2 > 60 && (G.t >> 4) % 2) ? confirmLabel() + (last ? ' PARA VOLVER AL INICIO' : ' PARA CONTINUAR') : ''], '#f7d01c'); }
      if (G.dialog) drawDialog();
    }
    if (G.mode === 'padcfg') drawPadConfig();
    if (G.notice) drawNotice();
    ctx.fillStyle = BG.scan || 'transparent'; ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- ARRANQUE ---------------- */
  function isTouch() { return !!(hooks.isTouch && hooks.isTouch()); }
  // tocar la pantalla del juego confirma en menús y diálogos
  on(cv, 'pointerdown', () => { audioInit(); if (G.mode === 'padcfg') { pad.skipStep(); return; } if (G.mode !== 'play') { press('start'); setTimeout(() => release('start'), 60); } });
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
    const sheetKeys = Object.keys(assets.sheets);
    const [base, sheetImgs] = await Promise.all([
      Promise.all([loadImg(assets.hero.src), loadImg(assets.alfonso), loadImg(assets.carlos), loadImg(assets.logo), loadImg(assets.logoTitle), loadImg(assets.intro)]),
      Promise.all(sheetKeys.map(k => loadImg(assets.sheets[k].src))),
    ]);
    [IMG.hero, IMG.alf, IMG.carlos, IMG.logo, IMG.logoT, IMG.intro] = base;
    // panorámicas opcionales (assets/fondos/calle.png, finca.png…)
    IMG.fondos = {};
    const fondoKeys = Object.keys(assets.fondos || {});
    (await Promise.all(fondoKeys.map(k => loadImg(assets.fondos[k])))).forEach((im, i) => { if (im) IMG.fondos[fondoKeys[i]] = im; });
    sheetKeys.forEach((k, i) => { SHEETS[k] = { img: sheetImgs[i], meta: assets.sheets[k].meta }; });
    SHEETS.hero = { img: IMG.hero, meta: HERO_META };
    if (!alive) return;
    for (const k in SHEETS) { SHEETS[k].white = whiteOf(SHEETS[k].img); SHEETS[k].dark = tinted(SHEETS[k].img, [0.08, 0.06, 0.1], [10, 8, 14]); }
    buildBackgrounds();
    G.mode = 'splash'; G.t2 = 0;
    if (hooks.debug) window.__cp = { G, IN, BG };
  }
  boot();

  return {
    press, release, setMuted,
    isMuted: () => audio.isMuted(),
    configurePad: openPadConfig,
    togglePause() { if (G.mode === 'play') G.mode = 'pause'; else if (G.mode === 'pause') G.mode = 'play'; },
    destroy() { alive = false; cancelAnimationFrame(raf); cleanup.forEach(f => f()); audio.destroy(); },
  };
  }
