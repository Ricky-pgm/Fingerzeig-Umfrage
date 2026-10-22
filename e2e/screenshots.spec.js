// Renders every step at 390 x 844 for design review. Run with `npm run screenshots`; the CI job uploads the folder.
import { test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const dir = process.env.SHOTS_DIR || 'screenshots';
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const radio = (page, name) => page.getByRole('radio', { name }).or(page.getByRole('checkbox', { name })).check();

test('screenshots of all steps', async ({ page }) => {
  await mkdir(dir, { recursive: true });
  await page.route('**/api/submit', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '{"ok":true}' }));
  let n = 0;
  // Tall steps are captured with a viewport as high as the page, so the sticky action bar sits at the very end.
  const shot = async (name, tall = false) => {
    n += 1;
    await page.waitForTimeout(1600);
    if (tall) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: 390, height });
    }
    await page.screenshot({ path: `${dir}/${String(n).padStart(2, '0')}-${name}.png` });
    if (tall) await page.setViewportSize({ width: 390, height: 844 });
  };
  const next = (label = 'Weiter') => page.getByRole('button', { name: label }).click();

  await page.goto('/');
  await shot('start');
  await next(/Los geht/);
  await page.getByLabel(/einverstanden/).check();
  await next(/Los geht/);
  await shot('kochen', true);
  for (const name of ['Etwa einmal pro Woche', 'Tablet', 'Angelehnt, z. B. an die Wand', '50 cm bis 1 m']) await radio(page, name);
  await next();
  await shot('schmutzige-haende', true);
  await radio(page, 'Mit Knöchel, Ellbogen oder Handrücken tippen');
  await next();
  await radio(page, 'Zum nächsten Schritt');
  await next();
  await shot('gesten-intro');
  await next('Verstanden');
  await next();
  await shot('geste-fehler', true);
  await radio(page, /Offene Hand/);
  await radio(page, /Wischen nach links/);
  await page.getByRole('group', { name: /passt/ }).getByRole('radio', { name: '4' }).check();
  await page.getByRole('group', { name: /leicht/ }).getByRole('radio', { name: /^5/ }).check();
  await shot('geste-ausgefuellt', true);
  await next();
  for (let i = 1; i < 5; i += 1) {
    await radio(page, /Faust/);
    await radio(page, /Still halten/);
    await page.getByRole('group', { name: /passt/ }).getByRole('radio', { name: '3' }).check();
    await page.getByRole('group', { name: /leicht/ }).getByRole('radio', { name: '3' }).check();
    await next();
  }
  await shot('versehen');
  await next();
  await radio(page, '25 bis 39');
  await radio(page, 'Rechts');
  await radio(page, /Sprachsteuerung/);
  await shot('zu-dir', true);
  await next();
  await shot('abschluss', true);
  await next('Antworten absenden');
  await shot('danke');
});
