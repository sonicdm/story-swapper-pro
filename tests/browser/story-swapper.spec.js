import { test, expect } from '@playwright/test';

test('plays a bundled Mad Lib from the built app', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Story Swapper' })).toBeVisible();
  const madLibsPanel = page.locator('#panel-madlibs');
  await expect(madLibsPanel.getByLabel('Choose a template')).toBeVisible();

  await madLibsPanel.getByRole('button', { name: 'Random', exact: true }).click();
  await expect(page.locator('#madlibs-select')).not.toHaveValue('');

  await madLibsPanel.getByRole('button', { name: 'Start Mad Lib' }).click();
  await expect(page.getByRole('heading', { name: 'Fill in the blanks' })).toBeVisible();

  const inputs = page.locator('#prompt-form input');
  await expect(inputs.first()).toBeVisible();
  expect(await inputs.count()).toBeGreaterThanOrEqual(8);

  await page.getByRole('button', { name: 'Surprise me' }).click();
  await expect.poll(async () => {
    const values = await inputs.evaluateAll(nodes => nodes.map(node => node.value));
    return values.length > 0 && values.every(Boolean);
  }).toBe(true);

  await page.locator('#btn-sticky-reveal').click();
  await expect(page.getByRole('heading', { name: 'Your Story' })).toBeVisible();
  await expect(page.locator('#story-output mark.swap').first()).toBeVisible();
  await expect(page.locator('#story-summary')).toContainText('Swaps:');
});
