/**
 * E2E Test: Convex Connection Debug
 *
 * Tests basic Convex connectivity to diagnose why mutations hang
 */

import { test, expect } from '@playwright/test';

test.describe('Convex Connection Debug', () => {
  test('should have CONVEX_URL defined', async ({ page }) => {
    await page.goto('/');

    // Check if environment variable is accessible
    const convexUrl = await page.evaluate(() => {
      return (window as any).__NEXT_DATA__?.props?.pageProps?.env?.NEXT_PUBLIC_CONVEX_URL ||
             process.env.NEXT_PUBLIC_CONVEX_URL ||
             'NOT_FOUND';
    });

    console.log('Convex URL in browser:', convexUrl);
    expect(convexUrl).not.toBe('NOT_FOUND');
    expect(convexUrl).toContain('convex.cloud');
  });

  test('should load projects list (tests Convex query)', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    await page.goto('/');

    // Wait for either projects to load OR spinner to appear
    const hasProjects = await Promise.race([
      page.locator('[data-project-card]').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      page.locator('.animate-spin').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => false).catch(() => false),
    ]);

    console.log('Console logs:', consoleLogs.join('\n'));
    console.log('Has projects:', hasProjects);

    // The page should either show projects or show empty state, not perpetual loading
    const hasContent = await page.locator('text=/No projects yet|Test Project/i').isVisible().catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('should capture browser logs during project creation attempt', async ({ page }) => {
    const consoleLogs: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('requestfailed', request => {
      networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click New Project button
    await page.getByRole('button', { name: /new project|create project/i }).first().click();

    // Fill in name
    const nameInput = page.getByPlaceholder(/my video project/i);
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Debug Test Project');

    // Try to submit
    const submitButton = page.locator('form button[type="submit"]');
    await page.waitForTimeout(200); // Let React state update

    console.log('\n=== BEFORE SUBMIT ===');
    console.log('Console logs:', consoleLogs.join('\n'));
    console.log('Network errors:', networkErrors.join('\n'));

    await submitButton.click({ force: true });

    // Wait a bit to see what happens
    await page.waitForTimeout(5000);

    console.log('\n=== AFTER SUBMIT (5s) ===');
    console.log('Console logs:', consoleLogs.join('\n'));
    console.log('Network errors:', networkErrors.join('\n'));
    console.log('Current URL:', page.url());

    // Check if still on homepage or navigated
    const currentUrl = page.url();
    console.log('Navigation occurred:', !currentUrl.endsWith('/'));
  });
});
