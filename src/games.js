import { lazy } from 'react';
import beatCover from './assets/portada_beat.jpg';
import fightersCover from './assets/portada_fighters.jpg';

/* Juegos del menú de inicio.
   Cada juego es de uno de dos tipos:
   - load: un componente de este mismo proyecto (se abre en #/id y recibe onExit() para volver al menú)
   - url:  otro proyecto desplegado aparte (por ejemplo en Vercel); el menú abre esa dirección
   cover: imagen de la tarjeta (16:9; coverPos ajusta el encuadre)
   ready: false muestra "EN CONSTRUCCIÓN" y no deja entrar */

// Dirección del juego de pelea. Pon aquí la URL de su proyecto en Vercel,
// o defínela en Vercel como variable de entorno VITE_FIGHTERS_URL (Settings → Environment Variables).
const FIGHTERS_URL = import.meta.env.VITE_FIGHTERS_URL || '';

export const GAMES = [
  {
    id: 'beat',
    title: 'CAPITÁN PREMIER',
    genre: "BEAT 'EM UP · 1 JUGADOR",
    desc: 'Defiende la finca La Esperanza y la Calle Real del Doctor Cuajada y el Doctor Broca.',
    color: '#f7d01c',
    cover: beatCover, coverPos: 'center 30%',
    ready: true,
    load: lazy(() => import('./components/Game.jsx')),
  },
  {
    id: 'pelea',
    title: 'CAPITÁN PREMIER FIGHTERS',
    genre: 'PELEA 1 VS 1',
    desc: 'Torneo de pelea estilo arcade de los 90. El Capitán contra los villanos del Quindío, uno a uno.',
    color: '#ff7a2e',
    cover: fightersCover,
    url: FIGHTERS_URL,
    ready: !!FIGHTERS_URL, // queda "EN CONSTRUCCIÓN" mientras no haya dirección
  },
];
