/**
 * Test Helpers for ChatKut E2E Tests
 *
 * Common utilities and page object patterns for Playwright tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for Convex real-time sync to complete
 */
export async function waitForConvexSync(page: Page, timeout = 5000) {
  await page.waitForTimeout(1000); // Basic wait for Convex reactivity
}

/**
 * Create a new project
 */
export async function createProject(page: Page, projectName: string): Promise<string> {
  // Click "New Project" button (could be "Create Project" in empty state or "New Project" in header)
  const newProjectButton = page.getByRole('button', { name: /new project|create project/i }).first();
  await newProjectButton.click();

  // Wait for modal to appear and fill in project name
  const nameInput = page.getByPlaceholder(/my video project/i);
  await nameInput.waitFor({ state: 'visible' });

  // Type character by character to trigger onChange events naturally
  await nameInput.click(); // Focus the input
  await nameInput.pressSequentially(projectName, { delay: 50 });

  // Submit - wait for button to become enabled (React needs to update state)
  const submitButton = page.locator('form button[type="submit"]');

  // Wait for button to be enabled (triggered by React state update after input change)
  await expect(submitButton).toBeEnabled({ timeout: 5000 });

  // Now click the enabled button to trigger form submission
  await submitButton.click();

  // Wait for navigation to project page (increased timeout for Convex mutation)
  await page.waitForURL(/\/project\/\w+/, { timeout: 30000 });

  // Extract project ID from URL
  const url = page.url();
  const match = url.match(/\/project\/(\w+)/);

  if (!match) {
    throw new Error(`Could not extract project ID from URL: ${url}`);
  }

  return match[1];
}

/**
 * Navigate to project dashboard
 */
export async function navigateToProject(page: Page, projectId: string) {
  await page.goto(`/project/${projectId}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for upload to complete
 */
export async function waitForUploadComplete(page: Page, filename: string, timeout = 60000) {
  // Wait for asset to appear in library
  await page.waitForSelector(`[data-filename="${filename}"]`, { timeout });

  // Wait for status to be "ready"
  await page.waitForSelector(`[data-filename="${filename}"][data-status="ready"]`, { timeout });
}

/**
 * Send chat message
 */
export async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('textarea[placeholder*="Type a message"]').or(
    page.locator('textarea[placeholder*="Ask ChatKut"]')
  );

  await chatInput.fill(message);
  await chatInput.press('Enter');

  // Wait for AI response
  await page.waitForSelector('[data-role="assistant"]', { timeout: 15000 });
}

/**
 * Wait for element in composition
 */
export async function waitForElementInComposition(page: Page, elementId: string, timeout = 5000) {
  await page.waitForSelector(`[data-element-id="${elementId}"]`, { timeout });
}

/**
 * Click undo button
 */
export async function clickUndo(page: Page) {
  await page.getByRole('button', { name: /undo/i }).click();
  await waitForConvexSync(page);
}

/**
 * Click redo button
 */
export async function clickRedo(page: Page) {
  await page.getByRole('button', { name: /redo/i }).click();
  await waitForConvexSync(page);
}

/**
 * Select disambiguator option
 */
export async function selectDisambiguatorOption(page: Page, index: number) {
  const options = page.locator('[data-disambiguator-option]');
  await options.nth(index).click();
  await waitForConvexSync(page);
}

/**
 * Check if disambiguator is visible
 */
export async function isDisambiguatorVisible(page: Page): Promise<boolean> {
  const disambiguator = page.locator('[data-disambiguator]');
  return await disambiguator.isVisible();
}

/**
 * Get composition element count
 */
export async function getCompositionElementCount(page: Page): Promise<number> {
  const elements = page.locator('[data-element-id]');
  return await elements.count();
}

/**
 * Start render
 */
export async function startRender(page: Page, codec: 'h264' | 'h265' = 'h264') {
  // Navigate to render panel
  await page.getByRole('tab', { name: /render/i }).click();

  // Select codec
  await page.selectOption('select[name="codec"]', codec);

  // Click start render
  await page.getByRole('button', { name: /start render/i }).click();

  // Wait for render job to appear
  await page.waitForSelector('[data-render-job]', { timeout: 10000 });
}

/**
 * Wait for render to complete
 */
export async function waitForRenderComplete(page: Page, timeout = 300000) {
  // Wait for download button to appear
  await page.waitForSelector('button:has-text("Download")', { timeout });
}

/**
 * Get render job status
 */
export async function getRenderJobStatus(page: Page, jobId: string): Promise<string> {
  const job = page.locator(`[data-render-job="${jobId}"]`);
  const statusBadge = job.locator('[data-status]');
  return await statusBadge.getAttribute('data-status') || 'unknown';
}

/**
 * Get chat message count
 */
export async function getChatMessageCount(page: Page): Promise<number> {
  const messages = page.locator('[data-role="user"], [data-role="assistant"]');
  return await messages.count();
}

/**
 * Assert no console errors
 */
export async function assertNoConsoleErrors(page: Page, allowedErrors: string[] = []) {
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const isAllowed = allowedErrors.some(allowed => text.includes(allowed));
      if (!isAllowed) {
        consoleErrors.push(text);
      }
    }
  });

  // Wait a bit for any errors to appear
  await page.waitForTimeout(2000);

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected:\n${consoleErrors.join('\n')}`);
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `test-results/${name}-${timestamp}.png`, fullPage: true });
}
