import { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/engine.js';
import TouchPad from './TouchPad.jsx';

import heroSrc from '../assets/hero.png';
import heroMeta from '../assets/hero.json';
import brocaSrc from '../assets/broca.png';
import brocaMeta from '../assets/broca.json';
import minionSrc from '../assets/minion.png';
import minionMeta from '../assets/minion.json';
import alfonsoSrc from '../assets/alfonso.png';
import logoSrc from '../assets/logo.jpg';

const ASSETS = {
  hero: { src: heroSrc, meta: heroMeta },
  broca: { src: brocaSrc, meta: brocaMeta },
  minion: { src: minionSrc, meta: minionMeta },
  alfonso: alfonsoSrc,
  logo: logoSrc,
};

const prefersTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export default function Game() {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const stageRef = useRef(null);
  const gameRef = useRef(null);
  const [touch, setTouch] = useState(prefersTouch);
  const touchRef = useRef(touch);
  touchRef.current = touch;
  const [muted, setMuted] = useState(false);

  // arranca el motor una sola vez
  useEffect(() => {
    const debug = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
    const game = createGame(canvasRef.current, ASSETS, {
      isTouch: () => touchRef.current,
      onMuteChange: setMuted,
      debug,
    });
    gameRef.current = game;
    setMuted(game.isMuted());
    return () => { game.destroy(); gameRef.current = null; };
  }, []);

  // muestra los controles táctiles al primer toque
  useEffect(() => {
    const onTouch = () => setTouch(true);
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  // ajusta el lienzo 16:9 al espacio disponible
  useEffect(() => {
    const box = boxRef.current, stage = stageRef.current;
    const fit = () => {
      const aw = box.clientWidth;
      let ah = box.clientHeight;
      if (touch && window.innerHeight > window.innerWidth) ah = Infinity;
      let w = aw, h = (aw * 9) / 16;
      if (h > ah) { h = ah; w = (ah * 16) / 9; }
      stage.style.width = `${Math.floor(w)}px`;
      stage.style.height = `${Math.floor(h)}px`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener('resize', fit);
    fit();
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [touch]);

  return (
    <div className={`shell${touch ? ' touch' : ''}`}>
      <header className="bar">
        <h1>CAPITÁN PREMIERE <span>vs EL DOCTOR BROCA</span></h1>
        <div className="tools">
          <button type="button" onClick={() => gameRef.current?.togglePause()}>PAUSA</button>
          <button type="button" aria-pressed={muted} onClick={() => gameRef.current?.setMuted(!muted)}>
            {muted ? 'SONIDO: NO' : 'SONIDO: SÍ'}
          </button>
        </div>
      </header>
      <div className="box" ref={boxRef}>
        <div className="stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label="Juego Capitán Premiere" />
        </div>
      </div>
      {touch && <TouchPad gameRef={gameRef} />}
      {touch && <p className="rotate-hint">Gira el celular para jugar en pantalla completa</p>}
    </div>
  );
}
