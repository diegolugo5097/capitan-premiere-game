/* =========================================================
   CONTENIDO DEL JUEGO: niveles, diálogos y vitrina de personajes.
   Edita aquí sin tocar el motor.

   Cada línea de diálogo es [quién, expresión, texto]:
     quién: 'A' = Alfonso Hernández Murcia, 'C' = Carlos Flórez
     expresión: número del retrato (Alfonso 0-15, Carlos 0-11),
     de izquierda a derecha y de arriba abajo en su cuadrícula.
   Carlos: 0 neutral, 1 risa, 2 carcajada, 3 ojos saltones, 4 lengua afuera,
     5 guiño, 6 asustado, 7 risa con nube, 8 cachetes inflados, 9 serio,
     10 risa de lado, 11 cachetes inflados 2.
   ========================================================= */

// Esbirros: machete, cuchillos (nivel 1) · garrote, encapuchado (nivel 2).
// Un "!" al final hace que el esbirro caiga desde arriba (balcón o barranco).
export const LEVELS = [
  {
    id: 'finca',
    name: 'NIVEL 1 · FINCA LA ESPERANZA',
    bg: 'finca',
    music: 'level',
    boss: {
      type: 'cuajada', name: 'DOCTOR CUAJADA', subtitle: 'Científico loco del lanzallamas',
      hp: 440, reinforce: ['machete!', 'cuchillos'],
    },
    intro: [
      ['A', 0, '¡Capitán! Soy Alfonso, desde la cabina del Café Premier. Y hoy no estoy solo...'],
      ['C', 1, '¡Carlos Flórez, para servirle! Yo vine por un tinto, pero ya que estoy, ayudo.'],
      ['A', 14, 'Tenemos problemas en la finca La Esperanza. El Doctor Cuajada se tomó el beneficiadero.'],
      ['C', 3, '¿El Doctor Cuajada? ¿El que vende cuajada con bocadillo en la plaza?'],
      ['A', 7, 'El mismo. Quiere cambiar todo el café de la región por cuajada, y contrató a los arrieros más bravos del Quindío.'],
      ['C', 6, 'Los del machete pegan duro, Capitán. Y los de ruana roja tiran cuchillos... yo de usted me agacho.'],
      ['A', 6, 'Si te cansas, rompe los costales y las materas: a veces esconden un tinto.'],
      ['A', 1, '¡A la finca, Capitán! El Premier cuenta contigo.'],
    ],
    waveToasts: [
      ['C', 2, '¡Uy, qué patada! Ese arriero va a amanecer con el sombrero al revés.'],
      ['A', 11, 'Los de ruana roja lanzan cuchillos desde lejos. ¡Cámbiate de carril!'],
      ['C', 10, 'Ya se ve la casona. Huele a cuajada... y a problemas.'],
    ],
    preBoss: [
      ['A', 15, 'Ahí está, en el patio de secado: el mismísimo Doctor Cuajada.'],
      ['C', 8, '¿Ese es el doctor? Parece que se le quemó el laboratorio... con él adentro.'],
      ['A', 14, 'Su lanzallamas dispara bolas de fuego en varios carriles. ¡Cámbiate de carril y atácalo cuando recargue!'],
    ],
    bossHalf: ['C', 6, '¡Llamó más arrieros! ¿A estos también les pagan con cuajada?'],
    victoryBanner: '¡LA FINCA ESTÁ A SALVO!',
    victory: [
      ['A', 4, '¡LO LOGRASTE! El Doctor Cuajada quedó fuera de combate.'],
      ['C', 7, 'Al fin se le apagó el lanzallamas. Yo me llevo una cuajadita para el camino... por evidencia.'],
      ['A', 14, 'Pero hay malas noticias: el Doctor Broca va directo al pueblo con sus matones.'],
      ['A', 1, '¡A la Calle Real, Capitán! El Premier te necesita.'],
    ],
    endTitle: 'NIVEL 1 COMPLETADO',
    endLine: 'Siguiente parada: la Calle Real',
    waves: [
      { camX: 430, groups: [['machete', 'machete'], ['cuchillos', 'machete!']] },
      { camX: 1430, groups: [['cuchillos', 'machete'], ['machete!', 'cuchillos', 'machete']] },
      { camX: 2480, groups: [['machete', 'cuchillos!', 'machete'], ['cuchillos', 'cuchillos', 'machete!']] },
    ],
    bossCamX: 3500,
    props: [[620, 470, 'costal', 'cup'], [1180, 372, 'matera', 'oro'], [1290, 490, 'costal', 'cup'], [2150, 400, 'costal', 'cup'], [2330, 500, 'matera', 'oro'], [3080, 440, 'costal', 'cup'], [3350, 380, 'costal', 'oro']],
  },
  {
    id: 'calle',
    name: 'NIVEL 2 · CALLE REAL',
    bg: 'calle',
    music: 'level',
    boss: {
      type: 'broca', name: 'DOCTOR BROCA', subtitle: 'Guantes de acero y un tanque lleno de ácido',
      hp: 520, reinforce: ['garrote!', 'encapuchado'],
    },
    intro: [
      ['A', 0, 'Estamos en la Calle Real, a pocas cuadras del Premier.'],
      ['C', 3, 'Capitán... mire esos tipos. Esos no desayunan, esos almuerzan dos veces.'],
      ['A', 14, 'Son los matones del Doctor Broca. El del garrote barre todo a su alrededor: no te le pares al frente.'],
      ['A', 11, 'Y el encapuchado embiste como un bus de escalera en bajada. Esquívalo hacia arriba o hacia abajo.'],
      ['C', 5, 'Tranquilo, Capitán. Si se pone feo, yo distraigo... desde la cabina.'],
      ['A', 1, '¡Por el Premier, Capitán!'],
    ],
    waveToasts: [
      ['C', 2, '¡Cayó el gordo! Creo que se escuchó hasta en Filandia.'],
      ['A', 11, 'Cuando el del garrote levante el palo, aléjate: viene el barrido.'],
      ['C', 10, 'Ya se ve el letrero del Premier. ¡Huele a tinto recién hecho!'],
    ],
    preBoss: [
      ['A', 15, '¡Llegaste al Premier! Y ahí está... el mismísimo Doctor Broca.'],
      ['C', 6, '¿Ese es el doctor? Con esa barriga yo pensé que era el dueño de la fritanga.'],
      ['A', 14, 'Su tanque dispara ácido de broca y sus guantes de acero rompen el piso. ¡Cambia de carril para esquivarlo!'],
    ],
    bossHalf: ['C', 3, '¡Llamó a los gordos otra vez! Capitán, esto ya parece almuerzo familiar.'],
    victoryBanner: '¡EL PREMIER ESTÁ A SALVO!',
    victory: [
      ['A', 4, '¡LO LOGRASTE! El Doctor Broca quedó fuera de combate.'],
      ['C', 1, 'Ahora sí, ¿quién paga los tintos?'],
      ['A', 6, 'Invita la casa, Capitán. Sube al segundo piso: el Premier es tuyo.'],
    ],
    endTitle: '¡JUEGO COMPLETADO!',
    endLine: 'El Premier está a salvo... por ahora',
    waves: [
      { camX: 430, groups: [['encapuchado', 'garrote'], ['encapuchado!', 'encapuchado']] },
      { camX: 1430, groups: [['garrote', 'encapuchado'], ['garrote!', 'encapuchado', 'garrote']] },
      { camX: 2480, groups: [['encapuchado', 'garrote!', 'encapuchado'], ['garrote', 'garrote', 'encapuchado!']] },
    ],
    bossCamX: 3500,
    props: [[620, 470, 'matera', 'cup'], [1180, 372, 'costal', 'oro'], [1290, 490, 'matera', 'cup'], [2150, 400, 'costal', 'cup'], [2330, 500, 'matera', 'oro'], [3080, 440, 'costal', 'cup'], [3350, 380, 'matera', 'oro']],
  },
];

export const GAME_OVER_LINES = [
  ['A', 14, 'Uy, Capitán... hasta los héroes necesitan recargar.'],
  ['C', 7, '¿Otra taza? Yo invito... bueno, invita Alfonso.'],
];

// Vitrina de personajes: aparece en la portada si nadie toca nada por unos segundos.
// sheet: hoja de sprites del personaje · who: retrato para Alfonso ('A') y Carlos ('C')
export const CAST = [
  { name: 'CAPITÁN PREMIER', role: 'EL HÉROE', color: '#f7d01c', sheet: 'hero', anims: ['idle', 'punch', 'kick', 'special', 'win'],
    desc: 'El guardián del Café Premier. Puños de acero, patada de mula y un especial que gira como molino de café. Nunca le dice que no a un tinto.' },
  { name: 'ALFONSO HERNÁNDEZ MURCIA', role: 'EL ALIADO', color: '#7dff8a', who: 'A', exprs: [0, 1, 4, 14, 6],
    desc: 'El cerebro de la operación. Desde la cabina del Premier conoce cada vereda, cada calle y cada truco de los villanos.' },
  { name: 'CARLOS FLÓREZ', role: 'EL ASESOR NO OFICIAL', color: '#f7d01c', who: 'C', exprs: [0, 2, 4, 3, 7, 8],
    desc: 'Vino por un tinto y se quedó para la aventura. Sus consejos no siempre sirven, pero sus chistes sí.' },
  { name: 'DOCTOR CUAJADA', role: 'JEFE · NIVEL 1', color: '#ff8a3d', sheet: 'cuajada', anims: ['idle', 'special', 'kick', 'win'],
    desc: 'Científico loco de gafas rojas y tanques a la espalda. Se tomó la finca La Esperanza para cambiar el café por cuajada, y quema todo lo que se le atraviesa.' },
  { name: 'ARRIERO DEL MACHETE', role: 'ESBIRRO · NIVEL 1', color: '#e8dcc8', sheet: 'machete', anims: ['idle', 'walk', 'special', 'win'],
    desc: 'Ruana, sombrero vueltiao y machete en mano. Lento para pensar, rápido para tirar machetazos.' },
  { name: 'ARRIERO DE LOS CUCHILLOS', role: 'ESBIRRO · NIVEL 1', color: '#ff4a3d', sheet: 'cuchillos', anims: ['idle', 'special', 'kick', 'win'],
    desc: 'Ruana roja y cara tapada. Lanza cuchillos desde lejos y se escabulle antes de que lo alcances.' },
  { name: 'DOCTOR BROCA', role: 'JEFE · NIVEL 2', color: '#9fd36a', sheet: 'tanque', anims: ['idle', 'punch', 'special', 'win'],
    desc: 'Guantes de acero y un tanque de ácido de broca en la espalda. Quiere perforar cada grano de café del pueblo, empezando por el Premier.' },
  { name: 'MATÓN DEL GARROTE', role: 'ESBIRRO · NIVEL 2', color: '#ff6b3d', sheet: 'garrote', anims: ['idle', 'special', 'kick', 'win'],
    desc: 'Puro músculo, sombrero de paja y un garrote de guayacán. Cuando lo hace girar, barre la calle entera.' },
  { name: 'EL ENCAPUCHADO', role: 'ESBIRRO · NIVEL 2', color: '#4aa8ff', sheet: 'encapuchado', anims: ['idle', 'punch', 'special', 'win'],
    desc: 'Boxeador de pasamontañas y cinturón triple. Embiste como un bus de escalera en bajada.' },
];
