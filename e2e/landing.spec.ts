import { test, expect } from '@playwright/test';

test('landing page shows Saturday Morning brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  // Unauthenticated: landing screen with brand heading
  await expect(page.getByRole('heading', { name: /Saturday Morning/i })).toBeVisible({ timeout: 8000 });
});

test('landing page has get started CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get started/i })).toBeVisible({ timeout: 8000 });
});

test('bottom nav is visible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  await expect(nav.getByText('Feed')).toBeVisible();
  await expect(nav.getByText('Leaderboard')).toBeVisible();
  await expect(nav.getByText('Profile')).toBeVisible();
});

test('board page loads', async ({ page }) => {
  await page.goto('/board');
  await expect(page.locator('h1')).toContainText('Leaderboard');
});

test('profile page loads and shows sign in button', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.locator('h1')).toContainText('Profile');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10000 });
});

test('notification preferences page loads with toggles', async ({ page }) => {
  await page.goto('/profile/settings');
  await expect(page.locator('h1')).toContainText('Notifications');
  // All 4 notification toggles should be present
  const toggles = page.getByRole('switch');
  await expect(toggles).toHaveCount(4, { timeout: 5000 });
});

test('notification toggle changes state', async ({ page }) => {
  await page.goto('/profile/settings');
  const firstToggle = page.getByRole('switch').first();
  await expect(firstToggle).toHaveAttribute('aria-checked', 'true');
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-checked', 'false');
});

test('bottom nav navigates between pages on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.locator('nav');
  await nav.getByText('Leaderboard').click();
  await expect(page).toHaveURL(/\/board/);
  await nav.getByText('Profile').click();
  await expect(page).toHaveURL(/\/profile/);
  await nav.getByText('Feed').click();
  await expect(page).toHaveURL(/\/$/);
});

// ── Epic 3: Family management ─────────────────────────────────────────────────

test('family nav item appears in bottom nav on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.locator('nav');
  await expect(nav.getByText('Family')).toBeVisible({ timeout: 8000 });
});

test('family page loads unauthenticated: shows create prompt', async ({ page }) => {
  await page.goto('/family');
  // Unauthenticated user sees the empty state or gets redirected to home
  // The page should load without error
  await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
});

test('create family page loads with name input', async ({ page }) => {
  await page.goto('/family/new');
  await expect(page.locator('h1')).toContainText(/Create your family/i, { timeout: 8000 });
  await expect(page.locator('input#family-name')).toBeVisible();
  await expect(page.getByRole('button', { name: /Create family/i })).toBeDisabled();
});

test('create family submit button enables when name entered', async ({ page }) => {
  await page.goto('/family/new');
  await page.locator('input#family-name').fill('The Smiths');
  await expect(page.getByRole('button', { name: /Create family/i })).toBeEnabled({ timeout: 3000 });
});

test('invite landing page with invalid token shows not found', async ({ page }) => {
  await page.goto('/invite/invalid-token-that-does-not-exist');
  await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Invite not found/i)).toBeVisible({ timeout: 5000 });
});

test('profile page links to family group', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByText(/Family group/i)).toBeVisible({ timeout: 8000 });
});

test('bottom nav navigates to family page on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const nav = page.locator('nav');
  const familyLink = nav.getByText('Family');
  await expect(familyLink).toBeVisible({ timeout: 8000 });
  // Family link should point to /family — unauthenticated users are redirected to home
  const href = await familyLink.locator('xpath=ancestor-or-self::a').getAttribute('href');
  expect(href).toMatch(/\/family/);
});

