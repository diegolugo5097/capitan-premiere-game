import { useEffect, useRef } from 'react';
import { createGamepad } from '../game/gamepad.js';

/* Entrada para menús: teclado y mando (usa la misma configuración de mando
   que el juego, así que un GameSir ya configurado funciona igual aquí).
   handlers: { move(dir), confirm(), back() } · dir = 'left' | 'right' | 'up' | 'down' */
export function useMenuInput(handlers, { onPad } = {}) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    // un instante de gracia: el botón con el que se entró o salió no cuenta aquí
    const since = performance.now();
    const fire = (name, arg) => { if (performance.now() - since < 300) return; const h = ref.current[name]; if (h) h(arg); };
    const KEYS = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Enter: 'confirm', Space: 'confirm', KeyJ: 'confirm', KeyZ: 'confirm',
      Escape: 'back', Backspace: 'back', KeyK: 'back', KeyX: 'back',
    };
    const onKey = e => {
      const a = KEYS[e.code];
      if (!a || e.repeat) return;
      e.preventDefault();
      if (a === 'confirm' || a === 'back') fire(a); else fire('move', a);
    };
    window.addEventListener('keydown', onKey);

    // mando: A, X o START confirman · B vuelve · palanca o cruceta mueven
    const pad = createGamepad({
      getMode: () => 'menu',
      press(a) {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') fire('move', a);
        else if (a === 'jump' || a === 'punch' || a === 'start') fire('confirm');
        else if (a === 'special' || a === 'kick') fire('back');
      },
      release() {},
      onChange: connected => onPad && onPad(connected),
    });
    let raf = 0;
    const loop = () => { pad.poll(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); };
  }, []);
}
