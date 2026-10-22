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
  await page.getByRole('button', { name: 'Weiter' }).click();

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
    sessionStorage.setItem('fingerzeig-umfrage-v1', JSON.stringify({
      step: 13, consent: true,
      cooking: { dirtyHands: ['wash'], actions: ['next'], dirtyHandsOther: '', actionsOther: '', annoyance: '', frequency: 'weekly', device: 'phone', position: 'flat', distance: 'lt50' },
      order: ['next', 'back', 'timer', 'ingredients', 'pause'],
      gestures: Object.fromEntries(['next', 'back', 'timer', 'ingredients', 'pause'].map((a) => [a, { hand: 'fist', motion: 'still', note: '' }])),
      accidental: '', about: { age: 'lt25', handedness: 'right', experience: ['none'] }, comment: '', contact: '', website: '',
    }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Antworten absenden' }).click();
  await expect(page.getByRole('alert')).toContainText('nicht geklappt');
  await expect(page.getByRole('button', { name: 'Erneut senden' })).toBeEnabled();
});
