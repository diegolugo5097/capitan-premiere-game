# Capitán Premiere vs El Doctor Broca

Beat 'em up retro del Café Premiere hecho con React, Vite y canvas. El Capitán Premiere defiende el café del Doctor Broca y sus hombres broca en una calle de casas coloniales. Alfonso Hernández Murcia narra la historia desde la cabina.

## Correr en local

Requiere Node 18 o superior.

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

Para compilar la versión de producción y probarla:

```bash
npm run build
npm run preview
```

## Subir a Vercel

**Opción A, desde GitHub (recomendada):**

1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. En vercel.com entra a **Add New → Project** e importa el repositorio.
3. Vercel detecta Vite solo. Deja el comando `npm run build` y la carpeta `dist`, y pulsa **Deploy**.

Cada `git push` a la rama principal vuelve a publicar el juego.

**Opción B, desde la terminal:**

```bash
npm i -g vercel
vercel          # primera vez: vincula el proyecto
vercel --prod   # publica en producción
```

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Mover | Flechas / WASD | Palanca |
| Puño (combo de 3) | J / Z | PUÑO |
| Patada | K / X | PATADA |
| Saltar (+ golpe en el aire) | Espacio / L | SALTO |
| Especial (barra amarilla llena) | I / V o J+K | ESP |
| Golpe bajo / barrida | ↓ + puño / ↓ + patada | |
| Pausa / sonido | P / M | Botones de arriba |

## Estructura

```
src/
  App.jsx                 monta el juego
  components/Game.jsx     lienzo, barra superior y ajuste de tamaño
  components/TouchPad.jsx palanca y botones táctiles
  game/content.js         historia, diálogos de Alfonso, oleadas y objetos
  game/engine.js          motor: jugador, enemigos, jefe, cámara, dibujo
  game/audio.js           música y efectos sintetizados
  assets/                 hojas de sprites (PNG + JSON con los frames) y logo
```

## Cómo modificarlo

- **Historia y diálogos:** edita `src/game/content.js`. Cada línea es `[expresión, texto]`, donde la expresión es el número del retrato de Alfonso (0 a 15, de izquierda a derecha y de arriba abajo en `alfonso.png`).
- **Oleadas:** en `waves` de `content.js`. Los tipos son `broca` (puños), `pateador` (patadas) y `excavador` (se mete bajo tierra). Si agregas `!` al final, por ejemplo `'broca!'`, el enemigo cae desde un balcón.
- **Vida del jefe:** `boss.hp` en `content.js`.
- **Música:** en `src/game/audio.js`, objeto `SONGS`. Cada melodía tiene 16 fichas por compás: un número son semitonos sobre la nota base, `.` es silencio y `-` sostiene la nota anterior. Cambia `bpm` para acelerar o frenar.
- **Sprites:** cada PNG en `assets/` viene con un JSON que dice dónde está cada frame: `[x, y, ancho, alto, anclaX, anclaY]`. El ancla es el punto de los pies.
