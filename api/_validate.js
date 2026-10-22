import {
  ABOUT, CONTACT_MAX, COOKING, DURATION_MAX_S, GESTURE_ACTIONS, HAND_SHAPES, MOTIONS, RATING_MAX, RATING_MIN,
  SCHEMA_VERSION, TEXT_MAX, values,
} from '../questions.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function onlyKeys(obj, allowed, path) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) throw new Error(`unknown field ${path}${key}`);
  }
}

function optionalText(v, path) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') throw new Error(`${path} must be text`);
  const t = v.trim();
  if (t.length > TEXT_MAX) throw new Error(`${path} too long`);
  return t;
}

function rating(v, path) {
  if (!Number.isInteger(v) || v < RATING_MIN || v > RATING_MAX) throw new Error(`${path} invalid`);
  return v;
}

function choice(v, question, path) {
  const allowed = values(question.options);
  if (question.multi) {
    if (!Array.isArray(v) || v.length === 0) throw new Error(`${path} required`);
    if (new Set(v).size !== v.length) throw new Error(`${path} duplicate`);
    for (const item of v) if (!allowed.includes(item)) throw new Error(`${path} invalid`);
    return v;
  }
  if (!allowed.includes(v)) throw new Error(`${path} invalid`);
  return v;
}

function group(input, questions, path, extraText = []) {
  if (!isPlainObject(input)) throw new Error(`${path} missing`);
  const textKeys = extraText;
  onlyKeys(input, [...Object.keys(questions), ...textKeys], `${path}.`);
  const out = {};
  for (const [key, q] of Object.entries(questions)) out[key] = choice(input[key], q, `${path}.${key}`);
  for (const key of textKeys) out[key] = optionalText(input[key], `${path}.${key}`);
  return out;
}

export function validateSubmission(body) {
  if (!isPlainObject(body)) throw new Error('body must be an object');
  onlyKeys(body, ['answers', 'contact', 'website', 'submissionId', 'durationS'], '');
  if (body.website) throw new Error('rejected');
  if (typeof body.submissionId !== 'string' || !UUID.test(body.submissionId)) throw new Error('submissionId invalid');
  if (!Number.isInteger(body.durationS) || body.durationS < 0 || body.durationS > DURATION_MAX_S) {
    throw new Error('durationS invalid');
  }

  const a = body.answers;
  if (!isPlainObject(a)) throw new Error('answers missing');
  onlyKeys(a, ['consent', 'cooking', 'gestures', 'accidental', 'about', 'comment'], 'answers.');
  if (a.consent !== true) throw new Error('consent required');

  const cooking = group(a.cooking, COOKING, 'cooking', ['dirtyHandsOther', 'actionsOther', 'annoyance']);

  if (!Array.isArray(a.gestures) || a.gestures.length !== GESTURE_ACTIONS.length) {
    throw new Error('gestures incomplete');
  }
  const actionIds = values(GESTURE_ACTIONS);
  const seen = new Set();
  const positions = new Set();
  const gestures = a.gestures.map((g, i) => {
    if (!isPlainObject(g)) throw new Error(`gestures[${i}] invalid`);
    onlyKeys(g, ['action', 'position', 'hand', 'motion', 'note', 'fit', 'ease'], `gestures[${i}].`);
    if (!actionIds.includes(g.action) || seen.has(g.action)) throw new Error(`gestures[${i}].action invalid`);
    seen.add(g.action);
    if (!Number.isInteger(g.position) || g.position < 1 || g.position > GESTURE_ACTIONS.length
      || positions.has(g.position)) {
      throw new Error(`gestures[${i}].position invalid`);
    }
    positions.add(g.position);
    if (!values(HAND_SHAPES).includes(g.hand)) throw new Error(`gestures[${i}].hand invalid`);
    if (!values(MOTIONS).includes(g.motion)) throw new Error(`gestures[${i}].motion invalid`);
    const note = optionalText(g.note, `gestures[${i}].note`);
    if ((g.hand === 'other' || g.motion === 'other') && note.length < 3) {
      throw new Error(`gestures[${i}].note required`);
    }
    return {
      action: g.action, position: g.position, hand: g.hand, motion: g.motion, note,
      fit: rating(g.fit, `gestures[${i}].fit`), ease: rating(g.ease, `gestures[${i}].ease`),
    };
  });

  const about = group(a.about, ABOUT, 'about');
  if (about.experience.includes('none') && about.experience.length > 1) throw new Error('about.experience invalid');

  const answers = {
    consent: true,
    cooking,
    gestures,
    accidental: optionalText(a.accidental, 'accidental'),
    about,
    comment: optionalText(a.comment, 'comment'),
  };

  let contact = '';
  if (body.contact !== undefined && body.contact !== null && body.contact !== '') {
    if (typeof body.contact !== 'string') throw new Error('contact must be text');
    contact = body.contact.trim();
    if (contact.length < 3 || contact.length > CONTACT_MAX) throw new Error('contact length');
  }

  return {
    schemaVersion: SCHEMA_VERSION, submissionId: body.submissionId.toLowerCase(), durationS: body.durationS, answers, contact,
  };
}
