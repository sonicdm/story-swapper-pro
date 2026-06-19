import { test, expect } from '@playwright/test';

test('plays a created template draft', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('tab', { name: 'Create' }).click();
  await page.locator('#editor-text').fill('Hello {noun}, welcome to {place}.');
  await page.getByRole('button', { name: 'Play Draft' }).click();

  await expect(page.getByRole('heading', { name: 'Fill in the blanks' })).toBeVisible();
  const inputs = page.locator('#prompt-form input');
  await expect(inputs).toHaveCount(2);

  await inputs.nth(0).fill('friend');
  await inputs.nth(1).fill('Paris');
  await page.locator('#btn-sticky-reveal').click();

  await expect(page.getByRole('heading', { name: 'Your Story' })).toBeVisible();
  await expect(page.locator('#story-output')).toContainText('Hello friend, welcome to Paris.');
});

test('saves a custom markdown template and plays it from the picker', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('tab', { name: 'Create' }).click();
  await page.locator('#editor-title').fill('Tiny Memo');
  await page.locator('#editor-text').fill('## Tiny Memo\n\n- Bring a {adjective} {object}\n- Meet {person} at {place}');
  await page.getByRole('button', { name: 'Save Template' }).click();

  await expect(page.locator('#status')).toContainText('Saved "Tiny Memo"');

  await page.getByRole('tab', { name: 'Mad Libs' }).click();
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.locator('#madlibs-select').selectOption({ label: 'Tiny Memo' });
  await page.getByRole('button', { name: 'Start Mad Lib' }).click();

  await expect(page.getByRole('heading', { name: 'Fill in the blanks' })).toBeVisible();
  const inputs = page.locator('#prompt-form input');
  await expect(inputs).toHaveCount(4);
  await inputs.nth(0).fill('shiny');
  await inputs.nth(1).fill('clipboard');
  await inputs.nth(2).fill('Morgan');
  await inputs.nth(3).fill('the lobby');
  await page.locator('#btn-sticky-reveal').click();

  await expect(page.locator('#story-output h2')).toContainText('Tiny Memo');
  await expect(page.locator('#story-output')).toContainText('Bring a shiny clipboard');
  await expect(page.locator('#story-output')).toContainText('Meet Morgan at the lobby');
});

test('escapes hostile Gutenberg titles in search results', async ({ page }) => {
  await page.route('**/gutendex.com/books**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{
          id: 1,
          title: '<img src=x onerror=window.__xss=1>',
          media_type: 'Text',
          authors: [{ name: '<script>evil</script>' }],
          formats: {}
        }]
      })
    });
  });

  await page.goto('./');
  await page.getByRole('tab', { name: 'Public Domain' }).click();
  await page.locator('#btn-gutenberg-search').click();

  await expect(page.locator('#gutenberg-results li')).toBeVisible();
  const xss = await page.evaluate(() => window.__xss);
  expect(xss).toBeUndefined();
  await expect(page.locator('#gutenberg-results li')).toContainText('<img');
});

test('loads mocked poem search results', async ({ page }) => {
  await page.route('**/poetrydb.org/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{
        title: 'Mock Poem',
        author: 'Test Author',
        lines: ['Roses are {color}', 'Violets are {color}']
      }])
    });
  });

  await page.goto('./');
  await page.getByRole('tab', { name: 'Poem' }).click();
  await page.locator('#poem-author').fill('Test Author');
  await page.locator('#btn-poem-search').click();

  await expect(page.locator('#poem-selected')).toContainText('Mock Poem');
});
