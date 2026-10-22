// Single source of truth for the survey: used by the browser (app.js)
// and by the server-side validation (api/_validate.js).

export const SCHEMA_VERSION = 2;

export const TEXT_MAX = 600;
export const CONTACT_MAX = 120;
// Address of the device check shown on the thank-you page as a bonus. Empty hides it.
export const CHECK_URL = '';

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const DURATION_MAX_S = 86_400;

export const COOKING = {
  frequency: {
    label: 'Wie oft kochst du nach einem Rezept auf Handy, Tablet oder Laptop?',
    multi: false,
    options: [
      ['several_week', 'Mehrmals pro Woche'],
      ['weekly', 'Etwa einmal pro Woche'],
      ['monthly', 'Etwa einmal im Monat'],
      ['rarely', 'Seltener'],
    ],
  },
  device: {
    label: 'Welches Gerät nutzt du dabei meistens?',
    multi: false,
    options: [
      ['phone', 'Handy'],
      ['tablet', 'Tablet'],
      ['laptop', 'Laptop'],
      ['other', 'Etwas anderes'],
    ],
  },
  position: {
    label: 'Wo ist das Gerät, während du kochst?',
    multi: false,
    options: [
      ['leaning', 'Angelehnt, z. B. an die Wand'],
      ['flat', 'Flach auf der Arbeitsfläche'],
      ['stand', 'In einem Ständer oder einer Halterung'],
      ['hand', 'In der Hand oder Hosentasche'],
      ['other', 'Woanders'],
    ],
  },
  distance: {
    label: 'Wie weit bist du meistens davon entfernt?',
    multi: false,
    options: [
      ['lt50', 'Unter 50 cm'],
      ['50_100', '50 cm bis 1 m'],
      ['gt100', 'Mehr als 1 m'],
    ],
  },
  dirtyHands: {
    label: 'Deine Hände sind voller Teig, und du musst aufs Rezept schauen. Was machst du?',
    hint: 'Mehrere Antworten möglich',
    multi: true,
    options: [
      ['knuckle', 'Mit Knöchel, Ellbogen oder Handrücken tippen'],
      ['wash', 'Erst die Hände waschen'],
      ['towel', 'Durch ein Küchentuch tippen'],
      ['voice', 'Sprachassistent benutzen'],
      ['wait', 'Warten, bis ich fertig bin'],
      ['other', 'Etwas anderes'],
    ],
  },
  actions: {
    label: 'Was musst du beim Kochen am Gerät am häufigsten tun?',
    hint: 'Mehrere Antworten möglich',
    multi: true,
    options: [
      ['next', 'Zum nächsten Schritt'],
      ['back', 'Zurück zum vorherigen Schritt'],
      ['timer', 'Einen Timer stellen'],
      ['ingredients', 'Zutaten nachsehen'],
      ['unlock', 'Bildschirm entsperren'],
      ['zoom', 'Vergrößern oder scrollen'],
      ['other', 'Etwas anderes'],
    ],
  },
};

export const GESTURE_ACTIONS = [
  ['next', 'Weiter', 'Du bist mit dem Schritt fertig und willst zum nächsten.'],
  ['back', 'Zurück', 'Du willst noch einmal den Schritt davor lesen.'],
  ['timer', 'Timer starten', 'Im Schritt steht „10 Minuten köcheln“. Du willst den Timer starten.'],
  ['ingredients', 'Zutaten zeigen', 'Du willst kurz nachsehen, wie viel Mehl du brauchst.'],
  ['pause', 'Pause', 'Du rührst gleich kräftig im Topf. Die Kamera soll so lange nicht reagieren.'],
];

export const HAND_SHAPES = [
  ['open_palm', 'Offene Hand'],
  ['fist', 'Faust'],
  ['point', 'Ein Finger zeigt'],
  ['thumb_up', 'Daumen hoch'],
  ['thumb_down', 'Daumen runter'],
  ['victory', 'Zwei Finger (V)'],
  ['pinch', 'Finger zusammen'],
  ['other', 'Andere'],
];

export const MOTIONS = [
  ['still', 'Still halten'],
  ['swipe_left', 'Wischen nach links'],
  ['swipe_right', 'Wischen nach rechts'],
  ['swipe_up', 'Wischen nach oben'],
  ['swipe_down', 'Wischen nach unten'],
  ['circle', 'Kreisen'],
  ['tap', 'In die Luft tippen'],
  ['other', 'Andere'],
];

export const ABOUT = {
  age: {
    label: 'Wie alt bist du?',
    multi: false,
    options: [
      ['lt25', 'Unter 25'],
      ['25_39', '25 bis 39'],
      ['40_59', '40 bis 59'],
      ['60plus', '60 oder älter'],
    ],
  },
  handedness: {
    label: 'Mit welcher Hand schreibst du?',
    multi: false,
    options: [
      ['right', 'Rechts'],
      ['left', 'Links'],
      ['both', 'Beide'],
    ],
  },
  experience: {
    label: 'Was hast du schon einmal benutzt?',
    hint: 'Mehrere Antworten möglich',
    multi: true,
    options: [
      ['voice', 'Sprachsteuerung (z. B. Siri, Alexa)'],
      ['gesture', 'Gestensteuerung (z. B. Spielekonsole, Auto)'],
      ['none', 'Nichts davon'],
    ],
  },
};

export const RATINGS = {
  fit: { label: 'Wie gut passt diese Geste zur Aktion?', low: 'passt gar nicht', high: 'passt sehr gut' },
  ease: { label: 'Wie leicht ist sie auszuführen?', low: 'sehr schwer', high: 'sehr leicht' },
};

export const values = (options) => options.map((o) => o[0]);
