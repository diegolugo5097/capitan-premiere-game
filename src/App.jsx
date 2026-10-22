import { Suspense, useEffect, useState } from 'react';
import Launcher from './components/Launcher.jsx';
import { GAMES } from './games.js';

// la dirección decide qué se muestra: #/ menú · #/beat
const fromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  const g = GAMES.find(x => x.id === id);
  return g && g.ready && g.load ? g.id : null;
};

export default function App() {
  const [game, setGame] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setGame(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const play = id => { window.location.hash = `/${id}`; };
  const exit = () => { window.location.hash = '/'; };

  const current = GAMES.find(g => g.id === game);
  if (!current) return <Launcher onPlay={play} />;
  const GameComp = current.load;
  return (
    <Suspense fallback={<div className="loading">CARGANDO...</div>}>
      <GameComp key={current.id} onExit={exit} />
    </Suspense>
  );
}
