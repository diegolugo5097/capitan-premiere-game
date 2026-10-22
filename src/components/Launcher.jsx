import { useEffect, useRef, useState } from 'react';
import { useMenuInput } from './useMenuInput.js';
import { createAudio } from '../game/audio.js';
import { GAMES } from '../games.js';

import logoSrc from '../assets/logo.jpg';
import introSrc from '../assets/intro.jpg';

export default function Launcher({ onPlay }) {
  const [sel, setSel] = useState(() => {
    try { const i = GAMES.findIndex(g => g.id === sessionStorage.getItem('cp-last-game')); return i < 0 ? 0 : i; } catch (e) { return 0; }
  });
  const [pad, setPad] = useState(false);
  const [msg, setMsg] = useState('');
  const audioRef = useRef(null);
  const selRef = useRef(sel);
  selRef.current = sel;

  // música del menú (arranca con el primer clic, toque o tecla)
  useEffect(() => {
    const a = createAudio();
    audioRef.current = a;
    a.setMusic('title');
    return () => { a.destroy(); audioRef.current = null; };
  }, []);

  const sfx = name => { const a = audioRef.current; if (a) a.SFX[name](); };

  function choose(i) {
    const g = GAMES[i];
    if (!g.ready) { sfx('hurt'); setMsg(`${g.title}: todavía en construcción`); return; }
    sfx('select');
    try { sessionStorage.setItem('cp-last-game', g.id); } catch (e) { /* nada */ }
    if (g.url) { window.location.href = g.url; return; } // proyecto aparte
    onPlay(g.id);
  }

  useMenuInput({
    move(dir) {
      const d = dir === 'left' || dir === 'up' ? -1 : 1;
      const n = (selRef.current + d + GAMES.length) % GAMES.length;
      if (n !== selRef.current) { sfx('blip'); setSel(n); setMsg(''); }
    },
    confirm() { choose(selRef.current); },
  }, { onPad: setPad });

  return (
    <main className="launcher" style={{ '--intro': `url(${introSrc})` }}>
      <header className="launch-head">
        <img src={logoSrc} alt="Café Premier" className="launch-logo" />
        <h1 className="launch-title">ARCADE PREMIER</h1>
        <p className="launch-kicker">ELIGE TU JUEGO</p>
      </header>

      <div className="cards" role="listbox" aria-label="Juegos" aria-activedescendant={`game-${GAMES[sel].id}`}>
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            id={`game-${g.id}`}
            type="button"
            role="option"
            aria-selected={i === sel}
            className={`card${i === sel ? ' sel' : ''}${g.ready ? '' : ' soon'}`}
            style={{ '--accent': g.color }}
            onMouseEnter={() => { if (i !== sel) { sfx('blip'); setSel(i); } }}
            onClick={() => { setSel(i); choose(i); }}
          >
            <div className="card-art">
              <img src={g.cover} alt="" className="card-cover" style={{ objectPosition: g.coverPos || 'center' }} draggable="false" />
              {!g.ready && <span className="card-badge">EN CONSTRUCCIÓN</span>}
            </div>
            <span className="card-genre">{g.genre}</span>
            <span className="card-title">{g.title}</span>
            <span className="card-desc">{g.desc}</span>
            <span className="card-cta">{i === sel ? (g.ready ? '▶ JUGAR' : 'PRÓXIMAMENTE') : ''}</span>
          </button>
        ))}
      </div>

      <footer className="launch-foot">
        <p className="launch-msg" aria-live="polite">{msg}</p>
        <p className="launch-help">
          {pad ? 'PALANCA O CRUCETA: ELEGIR · A O START: JUGAR' : 'FLECHAS: ELEGIR · ENTER: JUGAR · O TOCA UNA TARJETA'}
        </p>
      </footer>
    </main>
  );
}
