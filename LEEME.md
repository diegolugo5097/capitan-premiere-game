# Actualización de la aventura para el proyecto React (Vercel)

Copia esto encima de tu proyecto `capitan-premier` (el del menú "Arcade Premier"):

| De este zip | A tu proyecto |
|---|---|
| `public/aventura/` (carpeta completa) | `public/aventura/` |
| `src/components/Game.jsx` | reemplaza `src/components/Game.jsx` |
| `vercel.json` | en la raíz (si ya tienes uno, agrega solo el bloque `headers`) |

Luego `git add . && git commit -m "Aventura: 3 mapas, Quetzalel, NPC" && git push`. Vercel la publica solo.

**Qué cambia:** la aventura ahora es la versión nueva (Finca La Promesa → el pueblo → el pueblo en ruinas, Quetzalel con 2 fases, la escena del pueblo incendiado, el ataque desde el cielo, NPC animados con colisión, burbujas de diálogo, sacos y materas que se rompen). El menú de React, la tarjeta de Fighters y la ruta `/#/beat` siguen igual.

**Notas:**
- El juego pesa unos 100 MB (`index.pck` 67 MB y `index.wasm` 35 MB). Entra en GitHub (límite de 100 MB por archivo) y en Vercel; la primera carga tarda unos segundos y luego queda en caché.
- La música arranca con el primer clic o tecla (regla de los navegadores).
- Los archivos viejos del motor (`src/game/engine.js`, `content.js`, `audio.js`) ya no se usan; puedes dejarlos o borrarlos.
- Al salir del juego (B o Retroceso en la portada o en la pausa) vuelve a tu menú: `Game.jsx` llama a `onExit()` si se lo pasas, o vuelve a `#/`.
- Para probar en tu PC: `npm run dev` y abre `/#/beat`.
