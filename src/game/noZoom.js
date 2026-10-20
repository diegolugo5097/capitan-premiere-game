/* Evita el zoom del navegador en celulares (doble toque y pellizco).
   iOS ignora user-scalable=no, así que se bloquea también por JavaScript. */
export function preventMobileZoom() {
  let lastTouchEnd = 0;
  const onTouchEnd = e => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) e.preventDefault();
    lastTouchEnd = now;
  };
  const block = e => e.preventDefault();
  const onTouchMove = e => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('dblclick', block, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, block, { passive: false }));
  return () => {
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('dblclick', block);
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.removeEventListener(ev, block));
  };
}
