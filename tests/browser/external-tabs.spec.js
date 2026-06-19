import { test, expect } from '@playwright/test';

test('plays a pasted template story', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('tab', { name: 'Paste Text' }).click();
  await page.locator('#paste-text').fill('Hello {noun}, welcome to {place}.');
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.getByRole('heading', { name: 'Fill in the blanks' })).toBeVisible();
  const inputs = page.locator('#prompt-form input');
  await expect(inputs).toHaveCount(2);

  await inputs.nth(0).fill('friend');
  await inputs.nth(1).fill('Paris');
  await page.locator('#btn-sticky-reveal').click();

  await expect(page.getByRole('heading', { name: 'Your Story' })).toBeVisible();
  await expect(page.locator('#story-output')).toContainText('Hello friend, welcome to Paris.');
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
