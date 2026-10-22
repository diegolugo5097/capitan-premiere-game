/* =========================================================
   MANDOS: Xbox, PlayStation, GameSir, 8BitDo, Switch Pro y genéricos
   usando la Gamepad API del navegador.

   - Lee TODOS los mandos conectados a la vez. Algunos controles
     (GameSir, receptores 2.4G) aparecen como varios dispositivos y
     el que recibe los botones no siempre es el primero.
   - Distribución "standard" (Xbox / PlayStation / modo X-input):
       0 A/✕  1 B/○  2 X/□  3 Y/△  4 LB  5 RB  6 LT  7 RT
       8 View/Share  9 Menu/Options  12-15 cruceta  ejes 0-1 palanca
   - Mandos sin distribución estándar (modo D-input, Android, etc.):
     se lee la cruceta como "hat" (eje 9) y se pueden reasignar
     los botones con configure(); la asignación se guarda por mando.
   ========================================================= */

// Acción del juego → botones de la distribución estándar.
export const PAD_MAP = {
  jump: [0],          // A / ✕
  special: [1, 5, 7], // B / ○, RB / R1, RT / R2
  punch: [2],         // X / □
  kick: [3, 4, 6],    // Y / △, LB / L1, LT / L2
  menu: [9],          // Menu / Options: pausa y confirmar
  mute: [8],          // View / Share: sonido
};
// Pasos de la pantalla "Configurar mando"
export const PAD_STEPS = [
  ['up', 'ARRIBA'], ['down', 'ABAJO'], ['left', 'IZQUIERDA'], ['right', 'DERECHA'],
  ['punch', 'PUÑO'], ['kick', 'PATADA'], ['jump', 'SALTO'], ['special', 'ESPECIAL'], ['menu', 'PAUSA / START'],
];
const DPAD = { up: 12, down: 13, left: 14, right: 15 };
const DEADZONE = 0.35;
const ACTIONS = ['left', 'right', 'up', 'down', 'punch', 'kick', 'jump', 'special'];
const STORE = 'cp-padmap:';

const listPads = () => (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(p => p && p.connected);
const btnOn = (gp, i) => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };

// Cruceta tipo "hat": un solo eje con 8 posiciones (-1 arriba … 0.71 izquierda, >1 suelta)
function readHat(v) {
  if (v === undefined || v > 1.05 || v < -1.05) return null;
  const dir = Math.round((v + 1) / (2 / 7)); // 0..7 empezando arriba, en sentido horario
  return { up: dir === 7 || dir === 0 || dir === 1, right: dir >= 1 && dir <= 3, down: dir >= 3 && dir <= 5, left: dir >= 5 && dir <= 7 };
}

function loadMap(id) { try { const s = localStorage.getItem(STORE + id); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveMap(id, map) { try { localStorage.setItem(STORE + id, JSON.stringify(map)); } catch (e) { /* sin almacenamiento */ } }

function bindOn(gp, b) {
  if (!b) return false;
  if (b.t === 'b') return btnOn(gp, b.i);
  const v = gp.axes[b.i];
  if (v === undefined) return false;
  // eje de palanca o gatillo: basta con moverlo en la misma dirección
  if (Math.abs(b.base) < 0.3 && Math.abs(b.v) > 0.85) return v * Math.sign(b.v) > 0.5;
  if (b.base < -0.85 && b.v > 0) return v > 0; // gatillo que reposa en -1
  // cruceta tipo hat: posición exacta
  return Math.abs(v - b.v) < 0.2;
}
const bindLabel = b => !b ? '—' : b.t === 'b' ? `BOTÓN ${b.i}` : `EJE ${b.i} (${b.v > 0 ? '+' : ''}${b.v.toFixed(1)})`;

export function createGamepad({ press, release, getMode, onChange }) {
  const prev = {};
  const maps = {};
  let known = '';
  let cfg = null;
  // Vibración apagada por defecto: en algunos receptores de terceros
  // (GameSir, clones de Xbox 360) puede bloquear la lectura del control.
  let rumbleOn = false;
  try { rumbleOn = localStorage.getItem('cp-rumble') === '1'; } catch (e) { /* sin almacenamiento */ }
  const lastSignal = {}; // id → { ts, at }: última vez que cambió la lectura del mando
  let resync = false; // tras configurar, no disparar los botones que siguen presionados

  const mapFor = id => (id in maps ? maps[id] : (maps[id] = loadMap(id)));

  function readPad(gp) {
    const custom = mapFor(gp.id);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const stick = { left: ax < -DEADZONE, right: ax > DEADZONE, up: ay < -DEADZONE, down: ay > DEADZONE };
    const any = list => list.some(i => btnOn(gp, i));
    if (custom) {
      const std = { up: [DPAD.up], down: [DPAD.down], left: [DPAD.left], right: [DPAD.right], ...PAD_MAP };
      const r = {};
      for (const [a] of PAD_STEPS) r[a] = custom[a] ? bindOn(gp, custom[a]) : gp.mapping === 'standard' && any(std[a]);
      for (const d of ['up', 'down', 'left', 'right']) r[d] = r[d] || stick[d];
      r.mute = gp.mapping === 'standard' && any(PAD_MAP.mute);
      return r;
    }
    const r = {
      left: stick.left || btnOn(gp, DPAD.left), right: stick.right || btnOn(gp, DPAD.right),
      up: stick.up || btnOn(gp, DPAD.up), down: stick.down || btnOn(gp, DPAD.down),
      punch: any(PAD_MAP.punch), kick: any(PAD_MAP.kick), jump: any(PAD_MAP.jump), special: any(PAD_MAP.special),
      menu: any(PAD_MAP.menu), mute: any(PAD_MAP.mute),
    };
    if (gp.mapping !== 'standard') {
      const hat = readHat(gp.axes[9]);
      if (hat) for (const d in hat) r[d] = r[d] || hat[d];
    }
    return r;
  }

  // detecta mandos nuevos o desconectados (más fiable que los eventos)
  function checkConnections(pads) {
    const ids = pads.map(p => p.index + ':' + p.id).join('|');
    if (ids === known) return;
    const had = known !== '';
    known = ids;
    if (pads.length) onChange && onChange(true, pads.map(p => p.id).join(' '), !pads.some(p => p.mapping === 'standard' || mapFor(p.id)));
    else if (had) {
      ACTIONS.forEach(a => { if (prev[a]) release(a); prev[a] = false; });
      onChange && onChange(false, '', false);
    }
  }

  // se llama una vez por fotograma desde el bucle del juego
  function poll() {
    const pads = listPads();
    checkConnections(pads);
    const nowMs = performance.now();
    for (const gp of pads) {
      const L = lastSignal[gp.id];
      if (!L) lastSignal[gp.id] = { ts: gp.timestamp, at: null };
      else if (gp.timestamp !== L.ts) { L.ts = gp.timestamp; L.at = nowMs; }
    }
    if (cfg) { pollConfig(pads); return; }
    if (!pads.length) return;
    const want = {};
    for (const gp of pads) { const r = readPad(gp); for (const k in r) want[k] = want[k] || r[k]; }
    if (resync) { for (const k in want) prev[k] = !!want[k]; resync = false; return; }
    for (const a of ACTIONS) {
      if (want[a] && !prev[a]) press(a);
      else if (!want[a] && prev[a]) release(a);
      prev[a] = !!want[a];
    }
    if (want.menu && !prev.menu) {
      const m = getMode(), a = m === 'play' || m === 'pause' ? 'pause' : 'start';
      press(a); release(a);
    }
    if (want.mute && !prev.mute) { press('mute'); release('mute'); }
    prev.menu = !!want.menu; prev.mute = !!want.mute;
  }

  /* ---------- pantalla "Configurar mando" ---------- */
  function startConfig(onDone) {
    ACTIONS.forEach(a => { if (prev[a]) release(a); prev[a] = false; });
    cfg = { step: 0, binds: {}, id: null, base: null, idle: false, onDone, flash: 0 };
  }
  function snapshot(gp) { return gp.axes.map(v => v); }
  function pollConfig(pads) {
    if (cfg.flash > 0) cfg.flash--;
    // el mando que se configura es el primero que muestre actividad
    let gp = cfg.id ? pads.find(p => p.id === cfg.id) : null;
    if (!gp) {
      for (const p of pads) {
        if (p.buttons.some((b, i) => i !== 16 && btnOn(p, i))) { gp = p; cfg.id = p.id; break; }
      }
      if (!gp) { cfg.base = null; return; }
      cfg.base = null;
    }
    const used = Object.values(cfg.binds);
    const isUsed = b => used.some(u => u.t === b.t && u.i === b.i && (u.t === 'b' || Math.abs(u.v - b.v) < 0.2));
    const pressed = gp.buttons.findIndex((b, i) => i !== 16 && btnOn(gp, i));
    if (!cfg.base) { if (pressed === -1) { cfg.base = snapshot(gp); cfg.idle = true; } return; }
    const moved = gp.axes.findIndex((v, i) => Math.abs(v - cfg.base[i]) > 0.5);
    if (!cfg.idle) { if (pressed === -1 && gp.axes.every((v, i) => Math.abs(v - cfg.base[i]) < 0.3)) cfg.idle = true; return; }
    let bind = null;
    if (pressed !== -1) bind = { t: 'b', i: pressed };
    else if (moved !== -1) bind = { t: 'a', i: moved, v: Math.round(gp.axes[moved] * 100) / 100, base: Math.round(cfg.base[moved] * 100) / 100 };
    if (!bind || isUsed(bind)) return;
    cfg.binds[PAD_STEPS[cfg.step][0]] = bind;
    cfg.idle = false; cfg.flash = 12;
    nextStep();
  }
  function nextStep() {
    cfg.step++;
    if (cfg.step >= PAD_STEPS.length) {
      const id = cfg.id, done = cfg.onDone;
      const ok = !!id && Object.keys(cfg.binds).length > 0;
      if (ok) { maps[id] = cfg.binds; saveMap(id, cfg.binds); }
      cfg = null; resync = true;
      done && done(ok);
    }
  }

  // vibración (Xbox y PlayStation en Chrome/Edge; se ignora donde no exista)
  function rumble(strong, weak, ms) {
    if (!rumbleOn) return;
    for (const gp of listPads()) {
      const act = gp.vibrationActuator;
      if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    }
  }

  return {
    poll,
    rumble,
    connected: () => listPads().length > 0,
    configure: startConfig,
    rumbleEnabled: () => rumbleOn,
    setRumble(on) { rumbleOn = on; try { localStorage.setItem('cp-rumble', on ? '1' : '0'); } catch (e) { /* nada */ } if (on) rumble(0.5, 0.5, 200); },
    configuring: () => !!cfg,
    cancelConfig() { cfg = null; resync = true; },
    skipStep() { if (cfg) { cfg.idle = false; nextStep(); } },
    resetMaps() { for (const p of listPads()) { maps[p.id] = null; try { localStorage.removeItem(STORE + p.id); } catch (e) { /* nada */ } } },
    // datos para dibujar la pantalla de configuración y el diagnóstico
    configState() {
      if (!cfg) return null;
      return {
        step: cfg.step, total: PAD_STEPS.length, label: PAD_STEPS[cfg.step] ? PAD_STEPS[cfg.step][1] : '',
        flash: cfg.flash, waiting: !cfg.id,
        done: PAD_STEPS.slice(0, cfg.step).map(([a, l]) => [l, bindLabel(cfg.binds[a])]),
      };
    },
    diagnostics() {
      return listPads().map(gp => ({
        id: gp.id, mapping: gp.mapping || 'sin distribución estándar', custom: !!mapFor(gp.id),
        signal: (() => { const L = lastSignal[gp.id]; return !L || L.at === null ? 'sin señal todavía' : `última señal hace ${((performance.now() - L.at) / 1000).toFixed(1)} s`; })(),
        buttons: gp.buttons.map((b, i) => (btnOn(gp, i) ? i : -1)).filter(i => i >= 0),
        axes: gp.axes.map((v, i) => [i, v]).filter(([i, v]) => Math.abs(v) > 0.4 && !(i === 9 && v > 1.05)).map(([i, v]) => `${i}:${v.toFixed(1)}`),
      }));
    },
    destroy() { cfg = null; },
  };
}
