import {
  ABOUT, CHECK_URL, CONTACT_MAX, COOKING, GESTURE_ACTIONS, HAND_SHAPES, MOTIONS, RATINGS, TEXT_MAX, values,
} from './questions.js';
import { HAND_ICONS, KITCHEN_ICONS, MOTION_ICONS } from './icons.js';
import { tileOrder } from './tiles.js';

const STORE_KEY = 'fingerzeig-umfrage-v3';
const DONE_KEY = 'fingerzeig-umfrage-done';
const TAB_KEY = 'fingerzeig-umfrage-tab';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// ---------- storage (per viewer convenience only, may be unavailable) ----------
const store = {
  get(key, storage = localStorage) {
    try { return JSON.parse(storage.getItem(key)); } catch { return null; }
  },
  set(key, value, storage = localStorage) {
    try { storage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key, storage = localStorage) {
    try { storage.removeItem(key); } catch { /* ignore */ }
  },
};

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function freshState() {
  return {
    step: 0,
    submissionId: uuid(),
    startedAt: null,
    consent: false,
    cooking: { dirtyHands: [], actions: [], dirtyHandsOther: '', actionsOther: '', annoyance: '' },
    order: shuffled(GESTURE_ACTIONS.map((g) => g[0])),
    tiles: { hand: tileOrder(values(HAND_SHAPES)), motion: tileOrder(values(MOTIONS)) },
    gestures: {},
    accidental: '',
    about: { experience: [] },
    comment: '',
    contact: '',
    website: '',
  };
}

// Progress stays in this browser (not on the server) so a closed tab can be resumed; it expires after 14 days.
const savedState = store.get(STORE_KEY);
const usable = savedState && Date.now() - (savedState.savedAt ?? 0) < MAX_AGE_MS;
let state = usable ? savedState : freshState();
const reopened = !store.get(TAB_KEY, sessionStorage);
store.set(TAB_KEY, true, sessionStorage);
// A reload in the same tab continues directly; a returning visit gets the choice to resume or start over.
let resumeOffer = usable && reopened && state.step > 0 ? state.step : null;
const save = () => { state.savedAt = Date.now(); store.set(STORE_KEY, state); };

function restart() {
  store.remove(STORE_KEY);
  store.remove(DONE_KEY);
  state = freshState();
  resumeOffer = null;
  go(0);
}

// ---------- tiny DOM helper ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let uid = 0;
const nextId = (p) => `${p}-${uid += 1}`;

// ---------- reusable inputs ----------
const SVG_NS = 'http://www.w3.org/2000/svg';

function pictogram(parts) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'pic');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const part of parts) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', part.d);
    if (part.fill) path.setAttribute('fill', 'currentColor');
    if (part.transform) path.setAttribute('transform', part.transform);
    svg.append(path);
  }
  return svg;
}

// A drawn tick next to the question once it is answered. Animated only for the change that answered it.
let justAnswered = null;

function tick() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'tick');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M3 10.5l4.5 4.5L17 5" pathLength="1"/>';
  return svg;
}

function markAnswered(fieldset, label, answered, wasAnswered) {
  fieldset.classList.toggle('answered', answered);
  fieldset.classList.toggle('just', answered && !wasAnswered);
  if (answered && !wasAnswered) navigator.vibrate?.(8);
}

function choiceGroup(question, current, onChange, { tiles = false, cols = '', icons = null } = {}) {
  const name = nextId('q');
  const type = question.multi ? 'checkbox' : 'radio';
  const answered = (v) => (question.multi ? v.length > 0 : !!v);
  const options = question.options.map(([value, label]) => {
    const checked = question.multi ? current.includes(value) : current === value;
    const input = el('input', {
      type, name, value, checked, 'data-key': `${question.label}|${value}`,
      onchange: (e) => {
        const wasAnswered = answered(current);
        justAnswered = wasAnswered ? null : question.label;
        let next = value;
        if (question.multi) {
          const set = new Set(current);
          if (e.target.checked) set.add(value); else set.delete(value);
          next = [...set];
        }
        onChange(next);
        justAnswered = null;
        if (group.isConnected) markAnswered(group, question.label, answered(next), wasAnswered);
      },
    });
    const body = tiles
      ? el('span', {}, pictogram(icons[value]), el('small', {}, label))
      : el('span', {}, el('span', { class: 'check', 'aria-hidden': 'true' }), label);
    return el('label', { class: `opt${tiles ? ' tile' : ''}` }, input, body);
  });
  const group = el('fieldset', {},
    el('legend', {}, question.label, tick()),
    question.hint ? el('p', { class: 'hint' }, question.hint) : null,
    el('div', { class: `options ${cols}` }, options));
  if (answered(current)) {
    group.classList.add('answered');
    if (justAnswered === question.label) group.classList.add('just');
  }
  return group;
}

function scaleGroup({ label, low, high }, current, onChange) {
  const name = nextId('s');
  const options = [1, 2, 3, 4, 5].map((n) => el('label', { class: 'opt scale' },
    el('input', {
      type: 'radio', name, value: String(n), checked: current === n,
      onchange: () => {
        const wasAnswered = !!current;
        onChange(n);
        markAnswered(group, label, true, wasAnswered);
      },
      'data-key': `${label}|${n}`,
      'aria-label': n === 1 ? `1, ${low}` : n === 5 ? `5, ${high}` : String(n),
    }),
    el('span', {}, String(n))));
  const group = el('fieldset', {},
    el('legend', {}, label, tick()),
    el('div', { class: 'options scale-row' }, options),
    el('div', { class: 'scale-ends', 'aria-hidden': 'true' }, el('span', {}, low), el('span', {}, high)));
  if (current) group.classList.add('answered');
  return group;
}

function textArea(labelText, value, onInput, { optional = true, rows = 4, max = TEXT_MAX, single = false } = {}) {
  const id = nextId('t');
  const counterId = nextId('c');
  const counter = el('div', { class: 'counter', id: counterId }, `${value.length}/${max}`);
  const attrs = {
    id, maxlength: String(max), 'data-key': labelText, 'aria-describedby': counterId,
    oninput: (e) => { counter.textContent = `${e.target.value.length}/${max}`; onInput(e.target.value); },
  };
  const field = single
    ? el('input', { ...attrs, type: 'text', value, autocomplete: 'off' })
    : el('textarea', { ...attrs, rows: String(rows) });
  if (!single) field.value = value;
  return el('div', { class: `card tight${optional ? '' : ' required'}` },
    el('label', { class: 'field', for: id }, labelText, optional ? el('span', { class: 'muted' }, ' (optional)') : null),
    field, counter);
}

// ---------- errors shown at the field ----------
const control = (node) => (node.matches('fieldset')
  ? node.querySelector('input:checked') ?? node.querySelector('input')
  : node.querySelector('input, textarea'));

function clearError(node) {
  node.querySelector(':scope > .field-error')?.remove();
  node.classList.remove('invalid');
  const target = node.matches('fieldset') ? node : control(node);
  target?.removeAttribute('aria-describedby');
  target?.removeAttribute('aria-invalid');
}

function showError(node, message) {
  clearError(node);
  const id = nextId('err');
  node.querySelector('legend, label.field, label.consent').after(
    el('p', { class: 'field-error', id }, el('span', { 'aria-hidden': 'true' }, '! '), message));
  node.classList.add('invalid');
  const target = node.matches('fieldset') ? node : control(node);
  target.setAttribute('aria-describedby', id);
  if (!node.matches('fieldset')) target.setAttribute('aria-invalid', 'true');
  const clear = () => clearError(node);
  node.addEventListener('input', clear, { once: true });
  node.addEventListener('change', clear, { once: true });
}

const missing = (node, ok, message) => (ok ? [] : [[node, message]]);
const textProblem = (card) => (control(card).value.trim().length < 3
  ? [[card, 'Bitte beschreib es kurz (mindestens 3 Zeichen).']] : []);
const needsText = (root) => [...(root?.querySelectorAll('.card.required') ?? [])].flatMap(textProblem);

// The action bar stays at the bottom of the screen, within thumb reach. The button is never disabled:
// a click on an incomplete step shows what is missing at the field and moves focus there.
function nav({ checks, nextLabel = 'Weiter', onNext, back = true, accent = false }) {
  const proceed = () => {
    const problems = checks ? checks() : [];
    if (problems.length === 0) { onNext(); return; }
    for (const [node, message] of problems) showError(node, message);
    control(problems[0][0]).focus();
  };
  const nextButton = el('button', { type: 'button', class: `btn${accent ? ' accent' : ''}`, onclick: proceed }, nextLabel);
  const bar = el('div', { class: 'nav' },
    back ? el('button', { type: 'button', class: 'btn ghost', onclick: () => go(state.step - 1) }, 'Zurück') : null,
    nextButton);
  bar.nextButton = nextButton;
  return bar;
}

// ---------- steps ----------
const ARC = 'M40 300 C 140 80, 360 40, 500 150';
const arc = () => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 560 360');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'arc');
  svg.innerHTML = `<mask id="arc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="560" height="360"><path class="arc-draw" d="${ARC}" pathLength="1" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round"/></mask>`
    + `<path d="${ARC}" fill="none" stroke="#F2A65A" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 26" mask="url(#arc-mask)"/>`
    + '<path class="arc-head" d="M465 112 L505 153 L455 170" fill="none" stroke="#F2A65A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
};

const heroBlock = () => el('section', { class: 'hero' }, arc(),
  el('p', { class: 'pill' }, 'Studienprojekt · FOM'),
  el('h1', {}, 'Schon wieder Teig am ', el('span', { class: 'accent' }, 'Display?')),
  el('p', { class: 'lead' }, 'Ich baue eine Koch-App, die du ohne Touch steuerst.'));

function resumeView() {
  let armed = false;
  const status = el('p', { class: 'hint', role: 'status' });
  const reset = el('button', {
    type: 'button', class: 'btn ghost',
    onclick: () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Ja, löschen';
        status.textContent = 'Bitte noch einmal bestätigen: Deine bisherigen Antworten werden gelöscht.';
        return;
      }
      restart();
    },
  }, 'Neu beginnen');
  return [
    heroBlock(),
    el('h2', {}, 'Schön, dass du zurück bist.'),
    el('p', {}, `Du warst bei Frage ${resumeOffer} von ${LAST_QUESTION}. Deine bisherigen Antworten sind nur in diesem Browser gespeichert.`),
    status,
    el('div', { class: 'nav' }, reset,
      el('button', { type: 'button', class: 'btn accent', onclick: () => go(resumeOffer) }, 'Weitermachen')),
  ];
}

function welcome() {
  if (resumeOffer) return resumeView();
  const consent = el('input', {
    type: 'checkbox', id: 'consent', checked: state.consent,
    onchange: (e) => { state.consent = e.target.checked; save(); },
  });
  const consentField = el('div', {},
    el('label', { class: 'consent', for: 'consent' }, consent,
      el('span', {}, 'Ich bin einverstanden, dass meine Antworten anonym für das Projekt genutzt werden. ',
        el('button', { type: 'button', class: 'link', onclick: openPrivacy }, 'Datenschutz lesen'))));
  return [
    heroBlock(),
    el('p', { class: 'timeline' }, 'Dauert so lange, wie Nudelwasser zum Kochen braucht (ca. 8 Min.)'),
    el('h2', {}, 'Zeig mir, wie’s geht.'),
    el('p', {}, 'Hilf mir herauszufinden, welche Gesten sich für dich richtig anfühlen.'),
    el('ul', { class: 'facts' }, el('li', {}, 'anonym'), el('li', {}, 'keine richtigen oder falschen Antworten')),
    consentField,
    nav({
      back: false, accent: true, nextLabel: 'Los geht’s',
      checks: () => missing(consentField, state.consent, 'Bitte stimm zu, um zu starten.'),
      onNext: () => { state.startedAt ??= Date.now(); go(1); },
    }),
  ];
}

function cookingStep(keys, title, extra) {
  return () => {
    const c = state.cooking;
    const refresh = () => save();
    const groups = keys.map((k) => choiceGroup(COOKING[k], c[k] ?? (COOKING[k].multi ? [] : ''), (v) => {
      c[k] = v; refresh(); if (extra?.rerenderOn?.includes(k)) render();
    }));
    const extraNode = extra ? extra.node(refresh) : null;
    const next = nav({
      onNext: () => go(state.step + 1),
      checks: () => [
        ...keys.flatMap((k, i) => missing(groups[i], COOKING[k].multi ? c[k].length > 0 : !!c[k],
          COOKING[k].multi ? 'Bitte wähle mindestens eine Antwort.' : 'Bitte wähle eine Antwort.')),
        ...needsText(extraNode),
      ],
    });
    return [el('p', { class: 'eyebrow' }, 'Teil 1 · Kochen'), el('h2', {}, title), ...groups, extraNode, next];
  };
}

const otherText = (multiKey, textKey, labelText) => ({
  rerenderOn: [multiKey],
  node: (refresh) => (state.cooking[multiKey].includes('other')
    ? textArea(labelText, state.cooking[textKey], (v) => { state.cooking[textKey] = v; refresh(); }, { optional: false, single: true, max: 200 })
    : null),
});

function gestureIntro() {
  return [
    el('p', { class: 'eyebrow' }, 'Teil 2 · Deine Gesten'),
    el('h2', {}, 'Jetzt bist du gefragt.'),
    el('div', { class: 'card scenario' },
      el('p', {}, 'Stell dir vor: Du stehst in deiner Küche etwa einen Meter vor einem Tablet. Darauf läuft ein Rezept, und die Kamera erkennt deine Hand. Deine Hände sind voller Teig, du willst nichts berühren.')),
    el('p', { class: 'lead' }, 'Für fünf Aktionen wählst du, wie du deine Hand hältst und wie du sie bewegst. Probier die Bewegung ruhig kurz aus. Nimm die Geste, die dir als erste einfällt.'),
    nav({ nextLabel: 'Verstanden', onNext: () => go(state.step + 1) }),
  ];
}

const inOrder = (options, order) => order.map((id) => options.find((o) => o[0] === id));

function gestureStep(index) {
  return () => {
    const actionId = state.order[index];
    const [, title, situation] = GESTURE_ACTIONS.find((g) => g[0] === actionId);
    const g = state.gestures[actionId] ?? (state.gestures[actionId] = { hand: '', motion: '', note: '', fit: 0, ease: 0 });
    const needsNote = () => g.hand === 'other' || g.motion === 'other';
    const handGroup = choiceGroup({ label: 'Wie hältst du deine Hand?', options: inOrder(HAND_SHAPES, state.tiles.hand) }, g.hand,
      (v) => { g.hand = v; save(); render(); }, { tiles: true, cols: 'grid grid4', icons: HAND_ICONS });
    const motionGroup = choiceGroup({ label: 'Wie bewegst du sie?', hint: 'Richtungen aus deiner Sicht', options: inOrder(MOTIONS, state.tiles.motion) }, g.motion,
      (v) => { g.motion = v; save(); render(); }, { tiles: true, cols: 'grid grid4', icons: MOTION_ICONS });
    const fitGroup = scaleGroup(RATINGS.fit, g.fit, (v) => { g.fit = v; save(); });
    const easeGroup = scaleGroup(RATINGS.ease, g.ease, (v) => { g.ease = v; save(); });
    const note = textArea(needsNote() ? 'Beschreib deine Geste kurz' : 'Möchtest du etwas zu deiner Geste sagen?', g.note,
      (v) => { g.note = v; save(); }, { optional: !needsNote(), rows: 2, max: 300 });
    const navEl = nav({
      onNext: () => go(state.step + 1),
      checks: () => [
        ...missing(handGroup, !!g.hand, 'Bitte wähle eine Handform.'),
        ...missing(motionGroup, !!g.motion, 'Bitte wähle eine Bewegung.'),
        ...missing(fitGroup, !!g.fit, 'Bitte wähle eine Zahl von 1 bis 5.'),
        ...missing(easeGroup, !!g.ease, 'Bitte wähle eine Zahl von 1 bis 5.'),
        ...(needsNote() ? textProblem(note) : []),
      ],
    });
    return [
      el('p', { class: 'eyebrow' }, `Geste ${index + 1} von ${GESTURE_ACTIONS.length}`),
      el('div', { class: 'card scenario' }, el('div', {}, el('span', { class: 'tag' }, title), el('p', {}, situation)), pictogram(KITCHEN_ICONS[actionId])),
      handGroup, motionGroup, fitGroup, easeGroup, note, navEl,
    ];
  };
}

function accidentalStep() {
  return [
    el('p', { class: 'eyebrow' }, 'Teil 2 · Deine Gesten'),
    el('h2', {}, 'Und was soll lieber nichts auslösen?'),
    el('p', { class: 'lead' }, 'Beim Kochen bewegt man die Hände ständig. Welche Bewegung könnte aus Versehen eine Aktion auslösen?'),
    textArea('Deine Antwort', state.accidental, (v) => { state.accidental = v; save(); }, { rows: 3 }),
    nav({ onNext: () => go(state.step + 1) }),
  ];
}

function aboutStep() {
  const a = state.about;
  const age = choiceGroup(ABOUT.age, a.age ?? '', (v) => { a.age = v; save(); }, { cols: 'grid' });
  const hand = choiceGroup(ABOUT.handedness, a.handedness ?? '', (v) => { a.handedness = v; save(); });
  const experience = choiceGroup(ABOUT.experience, a.experience, (v) => {
    const added = v.find((x) => !a.experience.includes(x));
    a.experience = added === 'none' ? ['none'] : v.filter((x) => x !== 'none');
    save(); render();
  });
  return [
    el('p', { class: 'eyebrow' }, 'Teil 3 · Kurz zu dir'),
    el('h2', {}, 'Fast geschafft.'),
    age, hand, experience,
    nav({
      onNext: () => go(state.step + 1),
      checks: () => [
        ...missing(age, !!a.age, 'Bitte wähle eine Antwort.'),
        ...missing(hand, !!a.handedness, 'Bitte wähle eine Antwort.'),
        ...missing(experience, a.experience.length > 0, 'Bitte wähle mindestens eine Antwort.'),
      ],
    }),
  ];
}

function finalStep() {
  const error = el('p', { class: 'error', role: 'alert', hidden: true });
  const contact = textArea('Möchtest du die App später kurz testen? Dann hinterlass eine Kontaktmöglichkeit.', state.contact,
    (v) => { state.contact = v; save(); }, { single: true, max: CONTACT_MAX });
  const contactOk = () => !state.contact.trim() || state.contact.trim().length >= 3;
  const bar = nav({
    nextLabel: 'Antworten absenden', accent: true,
    onNext: () => submit(bar.nextButton, error),
    checks: () => missing(contact, contactOk(), 'Bitte gib mindestens 3 Zeichen ein oder lass das Feld leer.'),
  });
  return [
    el('p', { class: 'eyebrow' }, 'Abschluss'),
    el('h2', {}, 'Noch etwas?'),
    textArea('Gibt es noch etwas, das du mir sagen möchtest?', state.comment, (v) => { state.comment = v; save(); }, { rows: 3 }),
    contact,
    el('p', { class: 'hint' }, 'Die Kontaktangabe wird getrennt gespeichert und lässt sich deinen Antworten nicht zuordnen.'),
    el('div', { class: 'hp', 'aria-hidden': 'true' },
      el('label', {}, 'Website', el('input', { type: 'text', tabindex: '-1', autocomplete: 'off', oninput: (e) => { state.website = e.target.value; } }))),
    error,
    bar,
  ];
}

function thanks() {
  const status = el('p', { class: 'hint', role: 'status' });
  const share = navigator.share
    ? el('button', { type: 'button', class: 'btn', onclick: () => navigator.share({ title: 'fingerzeig – Umfrage', url: location.origin }).catch(() => {}) }, 'Umfrage teilen')
    : el('button', {
      type: 'button', class: 'btn',
      onclick: () => navigator.clipboard?.writeText(location.origin).then(
        () => { status.textContent = 'Link kopiert.'; },
        () => { status.textContent = `Bitte kopiere den Link: ${location.origin}`; },
      ),
    }, 'Link kopieren');
  return [el('section', { class: 'done' },
    el('div', { class: 'big' }, 'Danke!'),
    el('h2', {}, 'Deine Antworten sind angekommen.'),
    el('p', { class: 'lead' }, 'Sie helfen mir, Gesten zu gestalten, die sich natürlich anfühlen. Wenn du Leute kennst, die gern kochen: Teil den Link gern weiter.'),
    share,
    status,
    CHECK_URL ? el('div', { class: 'card bonus' },
      el('p', {}, el('strong', {}, 'Bonus: '), 'Erkennt dein Handy deine Hand?'),
      el('a', { class: 'btn accent', href: CHECK_URL }, 'Gerät testen')) : null,
    el('p', { class: 'hint' }, 'Eine zweite Person am selben Gerät?'),
    el('button', { type: 'button', class: 'btn ghost', onclick: restart }, 'Noch einmal teilnehmen'))];
}

const STEPS = [
  welcome,
  cookingStep(['frequency', 'device', 'position', 'distance'], 'Wie kochst du?'),
  cookingStep(['dirtyHands'], 'Und mit schmutzigen Händen?', {
    rerenderOn: ['dirtyHands'],
    node: (refresh) => el('div', {},
      state.cooking.dirtyHands.includes('other')
        ? textArea('Was machst du stattdessen?', state.cooking.dirtyHandsOther, (v) => { state.cooking.dirtyHandsOther = v; refresh(); }, { optional: false, single: true, max: 200 })
        : null,
      textArea('Was nervt dich beim Kochen mit Rezept auf dem Gerät am meisten?', state.cooking.annoyance, (v) => { state.cooking.annoyance = v; save(); }, { rows: 3 })),
  }),
  cookingStep(['actions'], 'Was tust du am Gerät?', otherText('actions', 'actionsOther', 'Was noch?')),
  gestureIntro,
  ...GESTURE_ACTIONS.map((_, i) => gestureStep(i)),
  accidentalStep,
  aboutStep,
  finalStep,
  thanks,
];
const LAST_QUESTION = STEPS.length - 2;

// ---------- submit ----------
async function submit(button, error) {
  button.disabled = true;
  button.textContent = 'Wird gesendet …';
  error.hidden = true;
  const payload = {
    answers: {
      consent: state.consent,
      cooking: state.cooking,
      gestures: state.order.map((action, i) => ({ action, position: i + 1, ...state.gestures[action] })),
      accidental: state.accidental,
      about: state.about,
      comment: state.comment,
    },
    contact: state.contact,
    website: state.website,
    submissionId: state.submissionId,
    durationS: Math.min(86_400, Math.max(0, Math.round((Date.now() - (state.startedAt ?? Date.now())) / 1000))),
  };
  try {
    const res = await fetch('/api/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    // 200 means the server already has this submission (a retry after a lost reply).
    if (res.status !== 201 && res.status !== 200) throw new Error(String(res.status));
    store.remove(STORE_KEY);
    store.set(DONE_KEY, true, localStorage);
    go(STEPS.length - 1);
  } catch {
    error.textContent = 'Das Absenden hat nicht geklappt. Bitte prüf deine Verbindung und versuch es noch einmal.';
    error.hidden = false;
    button.disabled = false;
    button.textContent = 'Erneut senden';
  }
}

// ---------- render ----------
const app = document.getElementById('app');
const progress = document.querySelector('.progress');
const pot = document.querySelector('.pot');
const progressText = document.querySelector('.progress-text');

function render() {
  const scrollY = window.scrollY;
  const focusKey = document.activeElement?.dataset?.key;
  const current = resumeOffer ? 0 : state.step;
  app.replaceChildren(...STEPS[current]().filter(Boolean));
  const inQuestions = current > 0 && current <= LAST_QUESTION;
  progress.hidden = !inQuestions;
  const pct = Math.round((Math.min(state.step, LAST_QUESTION) / LAST_QUESTION) * 100);
  progress.setAttribute('aria-valuenow', String(pct));
  progress.setAttribute('aria-valuetext', `Frage ${Math.min(state.step, LAST_QUESTION)} von ${LAST_QUESTION}`);
  progressText.textContent = `${Math.min(state.step, LAST_QUESTION)}/${LAST_QUESTION}`;
  pot.style.setProperty('--p', String(pct / 100));
  // The water starts to bubble from 60 % and steam rises on the last questions.
  pot.dataset.state = pct >= 90 ? 'steam' : pct >= 60 ? 'boil' : 'still';
  window.scrollTo(0, scrollY);
  if (focusKey) app.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

function go(step) {
  const back = step < state.step;
  resumeOffer = null;
  state.step = Math.max(0, Math.min(step, STEPS.length - 1));
  save();
  app.classList.remove('enter', 'enter-back');
  render();
  void app.offsetWidth;
  app.classList.add(back ? 'enter-back' : 'enter');
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

function openPrivacy() { document.getElementById('privacy').showModal(); }
document.getElementById('privacy-open').addEventListener('click', openPrivacy);

if (store.get(DONE_KEY)) {
  resumeOffer = null;
  state.step = STEPS.length - 1;
}
render();
