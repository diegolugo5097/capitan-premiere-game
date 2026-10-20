/* Historia, oleadas y diálogos del nivel 1. Edita aquí sin tocar el motor.
   Cada línea de diálogo es [expresión de Alfonso (0-15), texto]. */

export const LEVEL1 = {
  name: 'NIVEL 1 · CALLE REAL',
  boss: { name: 'DOCTOR BROCA', subtitle: 'Hypothenemus, terror de los cafetales', hp: 480 },
  intro: [
    [0, '¡Capitán! Soy Alfonso, desde la cabina del Café Premiere. Tenemos una emergencia.'],
    [14, 'El Doctor Broca escapó de su laboratorio con un taladro gigante y un ejército de hombres broca.'],
    [7, 'Quiere perforar cada grano de café del pueblo... y su objetivo final es el Premiere.'],
    [11, 'Ya están en las calles del centro. Salen de los balcones y de debajo del empedrado.'],
    [6, 'Si te cansas, rompe las materas y los costales: a veces esconden un tinto. Invita la casa.'],
    [1, '¡Vamos, Capitán! Que no quede ni una broca en pie.'],
  ],
  waveToasts: [
    [4, '¡Así se fumiga! Se nota que desayunaste.'],
    [11, 'Ojo con los rojizos: se meten bajo tierra y salen justo debajo de ti.'],
    [6, 'Ya se ve la casa del Premiere al fondo de la calle. ¡Sigue!'],
  ],
  preBoss: [
    [15, '¡Llegaste al Premiere! Y ahí está... el mismísimo Doctor Broca.'],
    [14, 'Su taladro dispara granos de café. ¡Cambia de carril para esquivarlos!'],
    [7, 'Defiende la casa, Capitán. El segundo piso cuenta contigo.'],
  ],
  bossHalf: [11, '¡Llamó más hombres broca! Usa el especial cuando la barra amarilla esté llena.'],
  victory: [
    [4, '¡LO LOGRASTE! El Doctor Broca quedó fuera de combate.'],
    [2, 'El café del pueblo está a salvo... por ahora.'],
    [6, 'Sube al segundo piso, Capitán. El tinto de la victoria corre por cuenta de la casa.'],
  ],
  gameOver: [14, 'Uy, Capitán... hasta los héroes necesitan recargar. ¿Otra taza?'],
  // tipos: broca (puños), pateador (patadas), excavador (bajo tierra). "!" = cae desde un balcón
  waves: [
    { camX: 430, groups: [['broca', 'broca'], ['broca!', 'pateador']] },
    { camX: 1430, groups: [['excavador', 'broca'], ['pateador!', 'broca', 'excavador']] },
    { camX: 2480, groups: [['broca!', 'broca', 'pateador'], ['excavador', 'excavador', 'pateador!']] },
  ],
  bossCamX: 3500,
  props: [[620, 470, 'matera', 'cup'], [1180, 372, 'costal', 'oro'], [1290, 490, 'matera', 'cup'], [2150, 400, 'costal', 'cup'], [2330, 500, 'matera', 'oro'], [3080, 440, 'costal', 'cup'], [3350, 380, 'matera', 'oro']],
};

