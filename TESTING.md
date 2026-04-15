# TESTING.md

## Unit & Component Tests (Vitest)
- All business logic and React components should have co-located `*.test.ts(x)` files.
- Run with `pnpm test`.
- Uses jsdom and @testing-library/react for component tests.

## E2E Tests (Playwright)
- All E2E tests live in the `e2e/` directory at the project root.
- Run with `pnpm exec playwright test`.
- Playwright config: `playwright.config.ts` at project root.
- E2E tests use the test database (port 5433, user dev, db iteration1_test).

## Database
- Local dev DB: port 5432, db `iteration1`, user `dev`/`dev`.
- Test DB for E2E: port 5433, db `iteration1_test`, user `dev`/`dev`.
- Both are started with `docker compose up -d` from the project root.

## Conventions
- Use `describe('functionName')` and `it('should verb when condition')` for test naming.
- Coverage threshold: 80% on `src/lib/` (business logic); no minimum on components.
- E2E helpers: place in `e2e/helpers/`.
