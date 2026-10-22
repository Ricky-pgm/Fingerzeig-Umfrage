import { test, expect } from '@playwright/test';

async function pick(page, name) {
  await page.getByRole('radio', { name }).or(page.getByRole('checkbox', { name })).check();
}

test('fills in the whole survey and submits it', async ({ page }) => {
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  let submitted = null;
  await page.route('**/api/submit', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();

  await pick(page, 'Etwa einmal pro Woche');
  await pick(page, 'Tablet');
  await pick(page, 'Angelehnt, z. B. an die Wand');
  await pick(page, '50 cm bis 1 m');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await pick(page, 'Mit Knöchel, Ellbogen oder Handrücken tippen');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await pick(page, 'Zum nächsten Schritt');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await page.getByRole('button', { name: 'Verstanden' }).click();
  for (let i = 0; i < 5; i += 1) {
    await pick(page, 'Offene Hand');
    await pick(page, 'Wischen nach links');
    await page.getByRole('group', { name: /passt/ }).getByRole('radio', { name: '4' }).check();
    await page.getByRole('group', { name: /leicht/ }).getByRole('radio', { name: /^5/ }).check();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }

  await page.getByRole('button', { name: 'Weiter' }).click();

  await pick(page, '25 bis 39');
  await pick(page, 'Rechts');
  await pick(page, 'Sprachsteuerung (z. B. Siri, Alexa)');
  await page.getByRole('button', { name: 'Weiter' }).click();

  await page.getByRole('button', { name: 'Antworten absenden' }).click();
  await expect(page.getByRole('heading', { name: 'Deine Antworten sind angekommen.' })).toBeVisible();

  expect(submitted.answers.gestures).toHaveLength(5);
  expect(new Set(submitted.answers.gestures.map((g) => g.action)).size).toBe(5);
  expect(submitted.answers.gestures.every((g) => g.fit === 4 && g.ease === 5)).toBe(true);
  expect(submitted.submissionId).toMatch(/^[0-9a-f-]{36}$/);
  expect(submitted.durationS).toBeGreaterThanOrEqual(0);
  expect(violations).toEqual([]);
});

test('keeps the progress after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await pick(page, 'Tablet');
  await page.reload();
  await expect(page.getByLabel('Tablet')).toBeChecked();
});

test('shows an error and allows a retry when sending fails', async ({ page }) => {
  await page.route('**/api/submit', (route) => route.fulfill({ status: 500, body: '{}' }));
  await page.addInitScript(() => {
    sessionStorage.setItem('fingerzeig-umfrage-tab', 'true');
    localStorage.setItem('fingerzeig-umfrage-v3', JSON.stringify({ savedAt: Date.now(),
      step: 12, consent: true,
      cooking: { dirtyHands: ['wash'], actions: ['next'], dirtyHandsOther: '', actionsOther: '', annoyance: '', frequency: 'weekly', device: 'phone', position: 'flat', distance: 'lt50' },
      order: ['next', 'back', 'timer', 'ingredients', 'pause'],
      gestures: Object.fromEntries(['next', 'back', 'timer', 'ingredients', 'pause'].map((a) => [a, { hand: 'fist', motion: 'still', note: '', fit: 3, ease: 3 }])),
      submissionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b', startedAt: 1, accidental: '', about: { age: 'lt25', handedness: 'right', experience: ['none'] }, comment: '', contact: '', website: '',
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Antworten absenden' }).click();
  await expect(page.getByRole('alert')).toContainText('nicht geklappt');
  await expect(page.getByRole('button', { name: 'Erneut senden' })).toBeEnabled();
});

test('lists "Andere" last in both tile groups and shows a pictogram on every tile', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await pick(page, 'Tablet');
  await pick(page, 'Angelehnt, z. B. an die Wand');
  await pick(page, '50 cm bis 1 m');
  await pick(page, 'Etwa einmal pro Woche');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Mit Knöchel, Ellbogen oder Handrücken tippen');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Zum nächsten Schritt');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();

  for (const group of [/Hand halten|hältst/, /bewegst/]) {
    const tiles = page.getByRole('group', { name: group }).locator('label.tile');
    await expect(tiles).toHaveCount(8);
    await expect(tiles.last()).toContainText('Andere');
    await expect(page.getByRole('group', { name: group }).locator('svg.pic')).toHaveCount(8);
  }
});

test('asks for consent at the checkbox instead of disabling the start button', async ({ page }) => {
  await page.goto('/');
  const start = page.getByRole('button', { name: /Los geht/ });
  await expect(start).toBeEnabled();
  await start.click();
  const checkbox = page.getByLabel(/einverstanden/);
  await expect(page.getByText('Bitte stimm zu, um zu starten.')).toBeVisible();
  await expect(checkbox).toBeFocused();
  await expect(checkbox).toHaveAccessibleDescription(/Bitte stimm zu/);
  await checkbox.check();
  await expect(page.getByText('Bitte stimm zu, um zu starten.')).toHaveCount(0);
});

test('shows what is missing at each field and focuses the first one', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await pick(page, 'Tablet');
  await page.getByRole('button', { name: 'Weiter' }).click();
  const frequency = page.getByRole('group', { name: /Wie oft kochst du/ });
  await expect(frequency.getByText('Bitte wähle eine Antwort.')).toBeVisible();
  await expect(frequency).toHaveAccessibleDescription(/Bitte wähle eine Antwort/);
  await expect(page.getByRole('radio', { name: 'Mehrmals pro Woche' })).toBeFocused();
  await expect(page.getByRole('group', { name: /Welches Gerät/ }).getByText('Bitte wähle')).toHaveCount(0);
});

test('keeps keyboard focus on the chosen tile when the step updates', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  for (const name of ['Etwa einmal pro Woche', 'Tablet', 'Angelehnt, z. B. an die Wand', '50 cm bis 1 m']) await pick(page, name);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Mit Knöchel, Ellbogen oder Handrücken tippen');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Zum nächsten Schritt');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Verstanden' }).click();
  const hands = page.getByRole('group', { name: /hältst/ });
  await hands.getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await expect(hands.getByRole('radio', { checked: true })).toBeFocused();
});

test('keeps the action bar at the bottom of the screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  const bar = page.locator('.nav');
  const box = await bar.boundingBox();
  const viewport = page.viewportSize();
  expect(box.y + box.height).toBeGreaterThan(viewport.height - 2);
});

async function toGestureStep(page) {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  for (const name of ['Etwa einmal pro Woche', 'Tablet', 'Angelehnt, z. B. an die Wand', '50 cm bis 1 m']) await pick(page, name);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Mit Knöchel, Ellbogen oder Handrücken tippen');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await pick(page, 'Zum nächsten Schritt');
  await page.getByRole('button', { name: 'Weiter' }).click();
}

test('the pot fills with the progress, bubbles late and steams on the last questions', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('progressbar')).toBeHidden();
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  const bar = page.getByRole('progressbar', { name: 'Fortschritt' });
  await expect(bar).toHaveAttribute('aria-valuetext', 'Frage 1 von 12');
  await expect(page.locator('.pot')).toHaveAttribute('data-state', 'still');
  await expect(page.locator('.progress-text')).toHaveText('1/12');
});

test('draws a tick next to an answered question, once', async ({ page }) => {
  await toGestureStep(page);
  await page.getByRole('button', { name: 'Verstanden' }).click();
  const fit = page.getByRole('group', { name: /passt/ });
  await expect(fit).not.toHaveClass(/answered/);
  await fit.getByRole('radio', { name: '3' }).check();
  await expect(fit).toHaveClass(/answered/);
  await expect(fit).toHaveClass(/just/);
  await page.getByRole('radio', { name: /Faust/ }).check();
  await expect(page.getByRole('group', { name: /passt/ })).toHaveClass(/answered/);
  await expect(page.getByRole('group', { name: /passt/ })).not.toHaveClass(/just/);
});

test('slides the step in without horizontal overflow, and not at all with reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/einverstanden/).check();
  await page.getByRole('button', { name: /Los geht/ }).click();
  await expect(page.locator('#app')).toHaveClass(/enter/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('radio', { name: 'Tablet' }).check();
  const name = await page.locator('#app > h2').evaluate((node) => getComputedStyle(node).animationName);
  expect(name).toBe('none');
});

for (const [step, state, valuetext] of [[9, 'boil', 'Frage 9 von 12'], [12, 'steam', 'Frage 12 von 12']]) {
  test(`the pot is in state "${state}" at step ${step}`, async ({ page }) => {
    await page.addInitScript((at) => {
      const gestures = Object.fromEntries(['next', 'back', 'timer', 'ingredients', 'pause'].map((a) => [a, { hand: 'fist', motion: 'still', note: '', fit: 3, ease: 3 }]));
      sessionStorage.setItem('fingerzeig-umfrage-tab', 'true');
    localStorage.setItem('fingerzeig-umfrage-v3', JSON.stringify({ savedAt: Date.now(),
        step: at, consent: true, submissionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b', startedAt: 1,
        cooking: { dirtyHands: ['wash'], actions: ['next'], dirtyHandsOther: '', actionsOther: '', annoyance: '', frequency: 'weekly', device: 'phone', position: 'flat', distance: 'lt50' },
        order: Object.keys(gestures), tiles: { hand: ['open_palm', 'fist', 'point', 'thumb_up', 'thumb_down', 'victory', 'pinch', 'other'], motion: ['still', 'swipe_left', 'swipe_right', 'swipe_up', 'swipe_down', 'circle', 'tap', 'other'] },
        gestures, accidental: '', about: { experience: [] }, comment: '', contact: '', website: '',
      }));
    }, step);
    await page.goto('/');
    await expect(page.locator('.pot')).toHaveAttribute('data-state', state);
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', valuetext);
  });
}

const savedAt3 = () => ({
  savedAt: Date.now(), step: 3, consent: true, submissionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b', startedAt: 1,
  cooking: { dirtyHands: ['wash'], actions: [], dirtyHandsOther: '', actionsOther: '', annoyance: '', frequency: 'weekly', device: 'tablet', position: 'flat', distance: 'lt50' },
  order: ['next', 'back', 'timer', 'ingredients', 'pause'],
  tiles: { hand: ['open_palm', 'fist', 'point', 'thumb_up', 'thumb_down', 'victory', 'pinch', 'other'], motion: ['still', 'swipe_left', 'swipe_right', 'swipe_up', 'swipe_down', 'circle', 'tap', 'other'] },
  gestures: {}, accidental: '', about: { experience: [] }, comment: '', contact: '', website: '',
});

test('offers to resume after the browser was closed, and continues where it stopped', async ({ page }) => {
  await page.addInitScript((saved) => { if (!localStorage.getItem('fingerzeig-umfrage-v3')) localStorage.setItem('fingerzeig-umfrage-v3', JSON.stringify(saved)); }, savedAt3());
  await page.goto('/');
  await expect(page.getByText('Du warst bei Frage 3 von 12.')).toBeVisible();
  await page.getByRole('button', { name: 'Weitermachen' }).click();
  await expect(page.getByRole('heading', { name: 'Was tust du am Gerät?' })).toBeVisible();
});

test('starting over needs a second click and then clears the saved answers', async ({ page }) => {
  await page.addInitScript((saved) => { if (!localStorage.getItem('fingerzeig-umfrage-v3')) localStorage.setItem('fingerzeig-umfrage-v3', JSON.stringify(saved)); }, savedAt3());
  await page.goto('/');
  await page.getByRole('button', { name: 'Neu beginnen' }).click();
  await expect(page.getByRole('status')).toContainText('noch einmal bestätigen');
  await page.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(page.getByRole('button', { name: /Los geht/ })).toBeVisible();
  await expect(page.getByLabel(/einverstanden/)).not.toBeChecked();
});

test('lets a second person take part after the first one submitted', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', 'true');
    localStorage.setItem('fingerzeig-umfrage-done', 'true');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Deine Antworten sind angekommen.' })).toBeVisible();
  await page.getByRole('button', { name: 'Noch einmal teilnehmen' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Los geht/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Los geht/ })).toBeVisible();
});

test('shows a kitchen picture on the gesture card and a share or copy button on the thank-you page', async ({ page }) => {
  await toGestureStep(page);
  await page.getByRole('button', { name: 'Verstanden' }).click();
  await expect(page.locator('.scenario svg.pic')).toHaveCount(1);

  await page.evaluate(() => { localStorage.setItem('fingerzeig-umfrage-done', 'true'); });
  await page.reload();
  await expect(page.getByRole('button', { name: /Umfrage teilen|Link kopieren/ })).toBeVisible();
  await expect(page.getByText('Erkennt dein Handy deine Hand?')).toHaveCount(0);
});
