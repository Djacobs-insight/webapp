# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> result detail page shows not found for invalid id
- Location: e2e\landing.spec.ts:191:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Result not found/i)
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for getByText(/Result not found/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic "Loading" [ref=e5]
  - alert [ref=e6]
```

# Test source

```ts
  93  | 
  94  | test('invite landing page with invalid token shows not found', async ({ page }) => {
  95  |   await page.goto('/invite/invalid-token-that-does-not-exist');
  96  |   await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  97  |   await expect(page.getByText(/Invite not found/i)).toBeVisible({ timeout: 5000 });
  98  | });
  99  | 
  100 | test('profile page links to family group', async ({ page }) => {
  101 |   await page.goto('/profile');
  102 |   await expect(page.getByText(/Family group/i)).toBeVisible({ timeout: 8000 });
  103 | });
  104 | 
  105 | test('bottom nav navigates to family page on mobile', async ({ page }) => {
  106 |   await page.setViewportSize({ width: 390, height: 844 });
  107 |   await page.goto('/');
  108 |   const nav = page.locator('nav');
  109 |   const familyLink = nav.getByText('Family');
  110 |   await expect(familyLink).toBeVisible({ timeout: 8000 });
  111 |   // Family link should point to /family — unauthenticated users are redirected to home
  112 |   const href = await familyLink.locator('xpath=ancestor-or-self::a').getAttribute('href');
  113 |   expect(href).toMatch(/\/family/);
  114 | });
  115 | 
  116 | // ── Epic 4: Result Entry ────────────────────────────────────────────────────
  117 | 
  118 | test('result entry page loads with heading', async ({ page }) => {
  119 |   await page.goto('/results/new');
  120 |   await expect(page.locator('h1')).toContainText('Add Result', { timeout: 8000 });
  121 | });
  122 | 
  123 | test('result entry page shows sign-in prompt when unauthenticated', async ({ page }) => {
  124 |   await page.goto('/results/new');
  125 |   await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible({ timeout: 8000 });
  126 | });
  127 | 
  128 | test('dashboard links to result entry', async ({ page }) => {
  129 |   await page.goto('/');
  130 |   // Unauthenticated: landing page has "Get started", not "Enter today's result"
  131 |   // Just verify the route loads
  132 |   await page.goto('/results/new');
  133 |   await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  134 | });
  135 | 
  136 | // ── Epic 4 Story 4.2: Age-Grading ──────────────────────────────────────────
  137 | 
  138 | test('onboarding wizard has gender step', async ({ page }) => {
  139 |   // The onboarding wizard includes a gender selection step
  140 |   // Verify the wizard component renders gender options
  141 |   await page.goto('/');
  142 |   // Since onboarding is controlled by localStorage, just verify the route is reachable
  143 |   await expect(page.locator('body')).toBeVisible({ timeout: 8000 });
  144 | });
  145 | 
  146 | test('result entry form still works without age-grading data', async ({ page }) => {
  147 |   // When user has no birthday/gender, result should save without age-grade
  148 |   await page.goto('/results/new');
  149 |   await expect(page.locator('h1')).toContainText('Add Result', { timeout: 8000 });
  150 |   // Verify save button exists
  151 |   await expect(page.getByRole('button', { name: /Save Result|Sign in/i })).toBeVisible();
  152 | });
  153 | 
  154 | // ── Epic 4 Story 4.3: Optimistic Result Submission ─────────────────────────
  155 | 
  156 | test('result form has save button for optimistic submit', async ({ page }) => {
  157 |   await page.goto('/results/new');
  158 |   await expect(page.locator('h1')).toContainText('Add Result', { timeout: 8000 });
  159 |   await expect(page.getByRole('button', { name: /Save Result|Sign in/i })).toBeVisible();
  160 | });
  161 | 
  162 | test('result form re-populates fields from query params on error rollback', async ({ page }) => {
  163 |   // Navigate to form with query params — unauthenticated user sees sign-in
  164 |   // Verify the page loads with query params (form only shown when authenticated)
  165 |   await page.goto('/results/new?date=2026-04-19&location=Test+Park&time=25%3A30');
  166 |   await expect(page.locator('h1')).toContainText('Add Result', { timeout: 8000 });
  167 |   // The URL preserves the query params for when the user signs in
  168 |   expect(page.url()).toContain('location=Test+Park');
  169 |   expect(page.url()).toContain('time=25%3A30');
  170 | });
  171 | 
  172 | test('result form pre-fills location from query param over home event', async ({ page }) => {
  173 |   await page.goto('/results/new?location=Override+Park');
  174 |   await expect(page.locator('h1')).toContainText('Add Result', { timeout: 8000 });
  175 |   expect(page.url()).toContain('location=Override+Park');
  176 | });
  177 | 
  178 | // ── Epic 4 Story 4.4: Result List & Detail View ───────────────────────────
  179 | 
  180 | test('board page shows empty state for unauthenticated user', async ({ page }) => {
  181 |   await page.goto('/board');
  182 |   await expect(page.getByText(/Sign in to view results/i)).toBeVisible({ timeout: 8000 });
  183 | });
  184 | 
  185 | test('board page renders family results heading or sign-in prompt', async ({ page }) => {
  186 |   await page.goto('/board');
  187 |   // Unauthenticated user sees sign-in prompt
  188 |   await expect(page.getByText(/Sign in to view results/i)).toBeVisible({ timeout: 8000 });
  189 | });
  190 | 
  191 | test('result detail page shows not found for invalid id', async ({ page }) => {
  192 |   await page.goto('/board/nonexistent-id-123');
> 193 |   await expect(page.getByText(/Result not found/i)).toBeVisible({ timeout: 8000 });
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  194 | });
  195 | 
  196 | test('result detail page has back navigation', async ({ page }) => {
  197 |   await page.setViewportSize({ width: 390, height: 844 });
  198 |   await page.goto('/board/nonexistent-id-123');
  199 |   await expect(page.getByLabel('Back')).toBeVisible({ timeout: 8000 });
  200 | });
  201 | 
  202 | test('history page shows sign-in prompt when unauthenticated', async ({ page }) => {
  203 |   await page.goto('/profile/history');
  204 |   await expect(page.getByText(/Sign in to view history/i)).toBeVisible({ timeout: 8000 });
  205 | });
  206 | 
  207 | test('history page has back navigation to profile', async ({ page }) => {
  208 |   await page.setViewportSize({ width: 390, height: 844 });
  209 |   await page.goto('/profile/history');
  210 |   await expect(page.getByLabel('Back')).toBeVisible({ timeout: 8000 });
  211 | });
  212 | 
  213 | test('trends page shows sign-in prompt when unauthenticated', async ({ page }) => {
  214 |   await page.goto('/profile/trends');
  215 |   await expect(page.getByText(/Sign in to view trends/i)).toBeVisible({ timeout: 8000 });
  216 | });
  217 | 
  218 | test('trends page has back navigation to profile', async ({ page }) => {
  219 |   await page.setViewportSize({ width: 390, height: 844 });
  220 |   await page.goto('/profile/trends');
  221 |   await expect(page.getByLabel('Back')).toBeVisible({ timeout: 8000 });
  222 | });
  223 | 
  224 | 
```