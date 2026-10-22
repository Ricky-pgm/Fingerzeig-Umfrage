import {
  ABOUT, CONTACT_MAX, COOKING, GESTURE_ACTIONS, HAND_SHAPES, MOTIONS, TEXT_MAX,
} from './questions.js';

const STORE_KEY = 'fingerzeig-umfrage-v2';
const DONE_KEY = 'fingerzeig-umfrage-done';

// ---------- storage (per viewer convenience only, may be unavailable) ----------
const store = {
  get(key, storage = sessionStorage) {
    try { return JSON.parse(storage.getItem(key)); } catch { return null; }
  },
  set(key, value, storage = sessionStorage) {
    try { storage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key, storage = sessionStorage) {
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
    gestures: {},
    accidental: '',
    about: { experience: [] },
    comment: '',
    contact: '',
    website: '',
  };
}

let state = store.get(STORE_KEY) || freshState();
const save = () => store.set(STORE_KEY, state);

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
function choiceGroup(question, current, onChange, { tiles = false, cols = '' } = {}) {
  const name = nextId('q');
  const type = question.multi ? 'checkbox' : 'radio';
  const options = question.options.map(([value, label, icon]) => {
    const checked = question.multi ? current.includes(value) : current === value;
    const input = el('input', {
      type, name, value, checked,
      onchange: (e) => {
        if (question.multi) {
          const set = new Set(current);
          if (e.target.checked) set.add(value); else set.delete(value);
          onChange([...set]);
        } else onChange(value);
      },
    });
    const body = tiles
      ? el('span', {},
        icon && icon.length <= 2 && /\p{Extended_Pictographic}/u.test(icon)
          ? el('span', { class: 'icon', 'aria-hidden': 'true' }, icon)
          : el('span', { class: 'sym', 'aria-hidden': 'true' }, icon),
        el('small', {}, label))
      : el('span', {}, el('span', { class: 'check', 'aria-hidden': 'true' }), label);
    return el('label', { class: `opt${tiles ? ' tile' : ''}` }, input, body);
  });
  return el('fieldset', {},
    el('legend', {}, question.label),
    question.hint ? el('p', { class: 'hint' }, question.hint) : null,
    el('div', { class: `options ${cols}` }, options));
}

function textArea(labelText, value, onInput, { optional = true, rows = 4, max = TEXT_MAX, single = false } = {}) {
  const id = nextId('t');
  const counter = el('div', { class: 'counter', 'aria-live': 'polite' }, `${value.length}/${max}`);
  const attrs = {
    id, maxlength: String(max),
    oninput: (e) => { counter.textContent = `${e.target.value.length}/${max}`; onInput(e.target.value); },
  };
  const field = single
    ? el('input', { ...attrs, type: 'text', value, autocomplete: 'off' })
    : el('textarea', { ...attrs, rows: String(rows) });
  if (!single) field.value = value;
  return el('div', { class: 'card tight' },
    el('label', { class: 'field', for: id }, labelText, optional ? el('span', { class: 'muted' }, ' (optional)') : null),
    field, counter);
}

function nav({ canNext, nextLabel = 'Weiter', onNext, back = true }) {
  const nextBtn = el('button', { type: 'button', class: 'btn', disabled: !canNext, onclick: onNext }, nextLabel);
  return el('div', { class: 'nav' },
    back ? el('button', { type: 'button', class: 'btn ghost', onclick: () => go(state.step - 1) }, 'Zurück') : null,
    nextBtn);
}

// ---------- steps ----------
const arc = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 560 360');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M40 300 C 140 80, 360 40, 500 150" fill="none" stroke="#F2A65A" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 26"/><path d="M465 112 L505 153 L455 170" fill="none" stroke="#F2A65A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
};

function welcome() {
  const consent = el('input', {
    type: 'checkbox', id: 'consent', checked: state.consent,
    onchange: (e) => { state.consent = e.target.checked; save(); start.disabled = !state.consent; },
  });
  const start = el('button', { type: 'button', class: 'btn accent', disabled: !state.consent, onclick: () => { state.startedAt ??= Date.now(); go(1); } }, 'Los geht’s');
  return [
    el('section', { class: 'hero' }, arc(),
      el('p', { class: 'eyebrow' }, 'Studienprojekt · FOM Hochschule'),
      el('h1', {}, 'Teig an den Händen. Rezept auf dem Tablet.'),
      el('p', { class: 'lead' }, 'Ich entwickle „Fingerzeig“, eine Koch-App, die man per Handbewegung vor der Kamera steuert. Bevor ich sie gestalte, möchte ich wissen, welche Gesten sich für dich natürlich anfühlen.')),
    el('ul', { class: 'facts' }, el('li', {}, 'ca. 8 Minuten'), el('li', {}, 'anonym'), el('li', {}, 'keine richtigen oder falschen Antworten')),
    el('label', { class: 'consent', for: 'consent' }, consent,
      el('span', {}, 'Ich bin einverstanden, dass meine Antworten anonym für das Projekt genutzt werden. ',
        el('button', { type: 'button', class: 'link', onclick: openPrivacy }, 'Datenschutz lesen'))),
    el('div', { class: 'nav' }, start),
  ];
}

function cookingStep(keys, title, extra) {
  return () => {
    const c = state.cooking;
    const done = () => keys.every((k) => (COOKING[k].multi ? c[k].length > 0 : !!c[k]))
      && (!extra || extra.valid());
    const refresh = () => { save(); next.querySelector('.btn:last-child').disabled = !done(); };
    const groups = keys.map((k) => choiceGroup(COOKING[k], c[k] ?? (COOKING[k].multi ? [] : ''), (v) => {
      c[k] = v; refresh(); if (extra?.rerenderOn?.includes(k)) render();
    }));
    const next = nav({ canNext: done(), onNext: () => go(state.step + 1) });
    return [el('p', { class: 'eyebrow' }, 'Teil 1 · Kochen'), el('h2', {}, title), ...groups, extra ? extra.node(refresh) : null, next];
  };
}

const otherText = (multiKey, textKey, labelText) => ({
  rerenderOn: [multiKey],
  valid: () => !state.cooking[multiKey].includes('other') || state.cooking[textKey].trim().length >= 3,
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
    nav({ canNext: true, nextLabel: 'Verstanden', onNext: () => go(state.step + 1) }),
  ];
}

function gestureStep(index) {
  return () => {
    const actionId = state.order[index];
    const [, title, situation] = GESTURE_ACTIONS.find((g) => g[0] === actionId);
    const g = state.gestures[actionId] ?? (state.gestures[actionId] = { hand: '', motion: '', note: '' });
    const needsNote = () => g.hand === 'other' || g.motion === 'other';
    const done = () => g.hand && g.motion && (!needsNote() || g.note.trim().length >= 3);
    const refresh = () => { save(); navEl.querySelector('.btn:last-child').disabled = !done(); };
    const navEl = nav({ canNext: done(), onNext: () => go(state.step + 1) });
    return [
      el('p', { class: 'eyebrow' }, `Geste ${index + 1} von ${GESTURE_ACTIONS.length}`),
      el('div', { class: 'card scenario' }, el('span', { class: 'tag' }, title), el('p', {}, situation)),
      choiceGroup({ label: 'Wie hältst du deine Hand?', options: HAND_SHAPES }, g.hand,
        (v) => { g.hand = v; save(); render(); }, { tiles: true, cols: 'grid grid4' }),
      choiceGroup({ label: 'Wie bewegst du sie?', hint: 'Richtungen aus deiner Sicht', options: MOTIONS }, g.motion,
        (v) => { g.motion = v; save(); render(); }, { tiles: true, cols: 'grid grid4' }),
      textArea(needsNote() ? 'Beschreib deine Geste kurz' : 'Möchtest du etwas zu deiner Geste sagen?', g.note,
        (v) => { g.note = v; refresh(); }, { optional: !needsNote(), rows: 2, max: 300 }),
      navEl,
    ];
  };
}

function accidentalStep() {
  return [
    el('p', { class: 'eyebrow' }, 'Teil 2 · Deine Gesten'),
    el('h2', {}, 'Und was soll lieber nichts auslösen?'),
    el('p', { class: 'lead' }, 'Beim Kochen bewegt man die Hände ständig. Welche Bewegung könnte aus Versehen eine Aktion auslösen?'),
    textArea('Deine Antwort', state.accidental, (v) => { state.accidental = v; save(); }, { rows: 3 }),
    nav({ canNext: true, onNext: () => go(state.step + 1) }),
  ];
}

function aboutStep() {
  const a = state.about;
  const done = () => a.age && a.handedness && a.experience.length > 0;
  const navEl = nav({ canNext: done(), onNext: () => go(state.step + 1) });
  const refresh = () => { save(); navEl.querySelector('.btn:last-child').disabled = !done(); };
  return [
    el('p', { class: 'eyebrow' }, 'Teil 3 · Kurz zu dir'),
    el('h2', {}, 'Fast geschafft.'),
    choiceGroup(ABOUT.age, a.age ?? '', (v) => { a.age = v; refresh(); }, { cols: 'grid' }),
    choiceGroup(ABOUT.handedness, a.handedness ?? '', (v) => { a.handedness = v; refresh(); }),
    choiceGroup(ABOUT.experience, a.experience, (v) => {
      const added = v.find((x) => !a.experience.includes(x));
      a.experience = added === 'none' ? ['none'] : v.filter((x) => x !== 'none');
      save(); render();
    }),
    navEl,
  ];
}

function finalStep() {
  const error = el('p', { class: 'error', role: 'alert', hidden: true });
  const send = el('button', { type: 'button', class: 'btn accent', onclick: () => submit(send, error) }, 'Antworten absenden');
  const contactOk = () => !state.contact.trim() || state.contact.trim().length >= 3;
  return [
    el('p', { class: 'eyebrow' }, 'Abschluss'),
    el('h2', {}, 'Noch etwas?'),
    textArea('Gibt es noch etwas, das du mir sagen möchtest?', state.comment, (v) => { state.comment = v; save(); }, { rows: 3 }),
    textArea('Möchtest du die App später kurz testen? Dann hinterlass eine Kontaktmöglichkeit.', state.contact,
      (v) => { state.contact = v; save(); send.disabled = !contactOk(); }, { single: true, max: CONTACT_MAX }),
    el('p', { class: 'hint' }, 'Die Kontaktangabe wird getrennt gespeichert und lässt sich deinen Antworten nicht zuordnen.'),
    el('div', { class: 'hp', 'aria-hidden': 'true' },
      el('label', {}, 'Website', el('input', { type: 'text', tabindex: '-1', autocomplete: 'off', oninput: (e) => { state.website = e.target.value; } }))),
    error,
    el('div', { class: 'nav' }, el('button', { type: 'button', class: 'btn ghost', onclick: () => go(state.step - 1) }, 'Zurück'), send),
  ];
}

function thanks() {
  const share = navigator.share
    ? el('button', { type: 'button', class: 'btn', onclick: () => navigator.share({ title: 'Fingerzeig – Umfrage', url: location.origin }).catch(() => {}) }, 'Umfrage teilen')
    : null;
  return [el('section', { class: 'done' },
    el('div', { class: 'big' }, 'Danke!'),
    el('h2', {}, 'Deine Antworten sind angekommen.'),
    el('p', { class: 'lead' }, 'Sie helfen mir, Gesten zu gestalten, die sich natürlich anfühlen. Wenn du Leute kennst, die gern kochen: Teil den Link gern weiter.'),
    share)];
}

const STEPS = [
  welcome,
  cookingStep(['frequency', 'device'], 'Wie kochst du?'),
  cookingStep(['position', 'distance'], 'Wo steht dein Gerät?'),
  cookingStep(['dirtyHands'], 'Und mit schmutzigen Händen?', {
    rerenderOn: ['dirtyHands'],
    valid: () => !state.cooking.dirtyHands.includes('other') || state.cooking.dirtyHandsOther.trim().length >= 3,
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
const fill = document.querySelector('.progress-fill');

function render() {
  const scrollY = window.scrollY;
  app.replaceChildren(...STEPS[state.step]().filter(Boolean));
  const inQuestions = state.step > 0 && state.step <= LAST_QUESTION;
  progress.hidden = !inQuestions;
  const pct = Math.round((Math.min(state.step, LAST_QUESTION) / LAST_QUESTION) * 100);
  progress.setAttribute('aria-valuenow', String(pct));
  fill.style.width = `${pct}%`;
  window.scrollTo(0, scrollY);
}

function go(step) {
  state.step = Math.max(0, Math.min(step, STEPS.length - 1));
  save();
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

function openPrivacy() { document.getElementById('privacy').showModal(); }
document.getElementById('privacy-open').addEventListener('click', openPrivacy);

if (store.get(DONE_KEY, localStorage)) state.step = STEPS.length - 1;
render();
