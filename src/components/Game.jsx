import { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/engine.js';
import TouchPad from './TouchPad.jsx';
import { preventMobileZoom } from '../game/noZoom.js';

import heroSrc from '../assets/hero.png';
import heroMeta from '../assets/hero.json';
import alfonsoSrc from '../assets/alfonso.png';
import carlosSrc from '../assets/carlos.png';
import logoSrc from '../assets/logo.jpg';
import logoTitleSrc from '../assets/logo_title.png';
import introSrc from '../assets/intro.jpg';
import cuajadaSrc from '../assets/cuajada.png';
import cuajadaMeta from '../assets/cuajada.json';
import garroteSrc from '../assets/garrote.png';
import garroteMeta from '../assets/garrote.json';
import macheteSrc from '../assets/machete.png';
import macheteMeta from '../assets/machete.json';
import cuchillosSrc from '../assets/cuchillos.png';
import cuchillosMeta from '../assets/cuchillos.json';
import tanqueSrc from '../assets/tanque.png';
import tanqueMeta from '../assets/tanque.json';
import encapuchadoSrc from '../assets/encapuchado.png';
import encapuchadoMeta from '../assets/encapuchado.json';

// Panorámicas de los niveles: pon calle.png o finca.png (también .jpg o .webp) en src/assets/fondos/
// y el juego las usa en lugar del fondo dibujado por código.
const FONDOS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/fondos/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase(), url])
);

const ASSETS = {
  hero: { src: heroSrc, meta: heroMeta },
  alfonso: alfonsoSrc,
  carlos: carlosSrc,
  logo: logoSrc,
  logoTitle: logoTitleSrc,
  intro: introSrc,
  fondos: FONDOS,
  // hojas de jefes y esbirros (filas idle, walk, crouch, jump, punch, kick, special, hurt, win)
  sheets: {
    cuajada: { src: cuajadaSrc, meta: cuajadaMeta },
    garrote: { src: garroteSrc, meta: garroteMeta },
    machete: { src: macheteSrc, meta: macheteMeta },
    cuchillos: { src: cuchillosSrc, meta: cuchillosMeta },
    tanque: { src: tanqueSrc, meta: tanqueMeta },
    encapuchado: { src: encapuchadoSrc, meta: encapuchadoMeta },
  },
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
  const [padOn, setPadOn] = useState(false);
  // con un mando conectado se ocultan los controles táctiles
  const showTouch = touch && !padOn;

  // arranca el motor una sola vez
  useEffect(() => {
    const debug = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
    const game = createGame(canvasRef.current, ASSETS, {
      isTouch: () => touchRef.current,
      onMuteChange: setMuted,
      onGamepad: setPadOn,
      debug,
    });
    gameRef.current = game;
    setMuted(game.isMuted());
    return () => { game.destroy(); gameRef.current = null; };
  }, []);

  // sin zoom por doble toque ni pellizco
  useEffect(() => preventMobileZoom(), []);

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
      if (showTouch && window.innerHeight > window.innerWidth) ah = Infinity;
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
  }, [showTouch]);

  return (
    <div className={`shell${showTouch ? ' touch' : ''}`}>
      <header className="bar">
        <h1>CAPITÁN PREMIER <span>vs DR. CUAJADA y DR. BROCA</span></h1>
        <div className="tools">
          <button type="button" onClick={() => gameRef.current?.configurePad()}>MANDO</button>
          <button type="button" onClick={() => gameRef.current?.togglePause()}>PAUSA</button>
          <button type="button" aria-pressed={muted} onClick={() => gameRef.current?.setMuted(!muted)}>
            {muted ? 'SONIDO: NO' : 'SONIDO: SÍ'}
          </button>
        </div>
      </header>
      <div className="box" ref={boxRef}>
        <div className="stage" ref={stageRef}>
          <canvas ref={canvasRef} aria-label="Juego Capitán Premier" />
        </div>
      </div>
      {showTouch && <TouchPad gameRef={gameRef} />}
      {showTouch && <p className="rotate-hint">Gira el celular para jugar en pantalla completa</p>}
    </div>
  );
}
