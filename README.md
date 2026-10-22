# Capitán Premier

Beat 'em up retro del Café Premier hecho con React, Vite y canvas. El Capitán Premier defiende la región en dos niveles, con Alfonso Hernández Murcia y Carlos Flórez narrando desde la cabina del café.

- **Nivel 1 · Finca La Esperanza:** camino de tierra entre cafetales. Esbirros: arrieros del machete y de los cuchillos. Jefe: el Doctor Cuajada, científico loco con lanzallamas.
- **Nivel 2 · Calle Real:** la calle de Circasia que termina en el Café Premier. Esbirros: el matón del garrote y el encapuchado. Jefe: el Doctor Broca, con su tanque de ácido y guantes de acero.

Si nadie toca nada en la portada durante 8 segundos, empieza la vitrina de personajes. Cualquier tecla, toque o botón la cierra.

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

| Acción | Teclado | Mando (Xbox / PlayStation) | Celular |
|---|---|---|---|
| Mover | Flechas / WASD | Palanca izquierda o cruceta | Palanca |
| Puño (combo de 3) | J / Z | X / □ | PUÑO |
| Patada | K / X | Y / △ · LB · LT | PATADA |
| Saltar (+ golpe en el aire) | Espacio / L | A / ✕ | SALTO |
| Especial (barra amarilla llena) | I / V o J+K | B / ○ · RB · RT | ESP |
| Golpe bajo / barrida | ↓ + puño / ↓ + patada | ↓ + X / ↓ + Y | |
| Pausa | P | Menu / Options | Botón de arriba |
| Sonido | M | View / Share | Botón de arriba |
| Configurar mando | G | Botón MANDO de arriba | |

### Mandos

El juego usa la Gamepad API del navegador, así que funciona con mandos de Xbox, PlayStation (DualShock 4 y DualSense), Switch Pro y la mayoría de controles genéricos, por USB o Bluetooth.

- Conecta el mando y **presiona cualquier botón**: el navegador no lo reporta hasta que lo usas. Arriba aparece el aviso "MANDO … CONECTADO".
- Navegadores compatibles: Chrome, Edge y Firefox en computador; Chrome en Android; Safari en iPhone y iPad (iOS 13 o superior con mandos de Xbox o PlayStation emparejados por Bluetooth).
- En celular, al conectar un mando se ocultan los controles táctiles.
- La vibración viene apagada porque en algunos receptores de terceros bloquea la lectura del control. Actívala con la tecla V dentro de la pantalla MANDO.
- Los navegadores no permiten que un botón del mando active el sonido. Si juegas solo con el mando, haz clic o toca la pantalla una vez.
- **Configurar mando:** si los botones quedan cruzados o la cruceta no responde (pasa con GameSir, 8BitDo y otros en modo D-input o Android), pulsa el botón **MANDO** de arriba, o la tecla G, y presiona cada acción cuando el juego la pida. La asignación se guarda en ese navegador para ese mando. Las acciones que saltes conservan su botón normal, y la tecla R en esa pantalla borra la configuración guardada. Esa pantalla también muestra qué está recibiendo el navegador, útil para diagnosticar.
- El juego escucha todos los mandos conectados a la vez, porque algunos controles aparecen como varios dispositivos.
- La distribución por defecto está en `PAD_MAP`, en `src/game/gamepad.js`.

## Estructura

```
src/
  App.jsx                 monta el juego
  components/Game.jsx     lienzo, barra superior y ajuste de tamaño
  components/TouchPad.jsx palanca y botones táctiles
  game/content.js         niveles, diálogos de Alfonso y Carlos, oleadas y vitrina de personajes
  game/engine.js          motor: jugador, enemigos, jefe, cámara, dibujo
  game/audio.js           música y efectos sintetizados
  game/gamepad.js         soporte de mandos (Xbox, PlayStation, genéricos)
  game/noZoom.js          evita el zoom por doble toque en celular
  assets/                 hojas de sprites (PNG + JSON con los frames), logos y escena de inicio
  assets/fondos/          panorámicas opcionales de los niveles (calle.png, finca.png)
```

## Cómo modificarlo

- **Historia y diálogos:** edita `src/game/content.js`. Cada línea es `['A' o 'C', expresión, texto]`: `'A'` es Alfonso y `'C'` es Carlos. La expresión es el número del retrato en su cuadrícula (`alfonso.png` de 0 a 15, `carlos.png` de 0 a 11), de izquierda a derecha y de arriba abajo.
- **Niveles y oleadas:** el arreglo `LEVELS` de `content.js`. Los esbirros son `machete`, `cuchillos`, `garrote` y `encapuchado`. Si agregas `!` al final, por ejemplo `'machete!'`, el esbirro cae desde arriba. Su vida, velocidad y ataques están en `ENEMY_TYPES`, dentro de `engine.js`. Los jefes (y qué cuadro usan en cada ataque) están en `BOSS_TYPES`, en el mismo archivo.
- **Vitrina de personajes:** el arreglo `CAST` de `content.js` (nombre, rol, descripción y animaciones).
- **Vida de los jefes:** `boss.hp` de cada nivel en `content.js`.
- **Panorámica de cada nivel:** pon `calle.png` (nivel 2) o `finca.png` (nivel 1) en `src/assets/fondos/` y el juego la usa en lugar del fondo dibujado por código. Tamaño recomendado: 4460 × 540, con el borde del andén al 63 % de la altura. Las instrucciones completas están en `src/assets/fondos/LEEME.txt`.
- **Pantalla de inicio:** el logo es `assets/logo_title.png` y la escena es `assets/intro.jpg`. Reemplázalos por archivos con el mismo nombre para cambiarlos. El tema musical de esa pantalla es `intro` en `audio.js`.
- **Música:** en `src/game/audio.js`, objeto `SONGS`. Cada melodía tiene 16 fichas por compás: un número son semitonos sobre la nota base, `.` es silencio y `-` sostiene la nota anterior. Cambia `bpm` para acelerar o frenar.
- **Sprites:** las hojas de jefes y esbirros siguen el mismo orden de filas que la del Capitán (idle, walk, crouch, jump, punch, kick, special, hurt, win). Cada PNG en `assets/` viene con un JSON que dice dónde está cada frame: `[x, y, ancho, alto, anclaX, anclaY]`. El ancla es el punto de los pies.
