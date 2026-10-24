// Capitán Premier Fighters (10 luchadores y selección de escenario).
// El juego está exportado desde Godot en public/aventura/ y se muestra aquí en pantalla completa.
// Al salir del juego (B / Retroceso en la portada o en la pausa) se vuelve al menú de React.
import { useEffect, useRef } from 'react';

export default function Fighter({ onExit }) {
  const frame = useRef(null);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data === 'cp-exit') {
        if (onExit) onExit();
        else window.location.hash = '#/';
      }
    };
    window.addEventListener('message', onMsg);
    // el foco va al juego para que el teclado y el control funcionen de una vez
    const t = setTimeout(() => frame.current && frame.current.focus(), 300);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, [onExit]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10 }}>
      <iframe
        ref={frame}
        title="Capitán Premier Fighters"
        src={`${import.meta.env.BASE_URL}aventura/index.html?juego=pelea`}
        allow="autoplay; fullscreen; gamepad"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        onClick={() => frame.current && frame.current.focus()}
      />
    </div>
  );
}
