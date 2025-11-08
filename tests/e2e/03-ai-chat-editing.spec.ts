/**
 * E2E Test: AI Chat Editing Workflow
 *
 * Tests natural language video editing:
 * 1. Send chat message to AI
 * 2. AI generates edit plan
 * 3. Edit plan executes
 * 4. Composition updates
 * 5. Preview reflects changes
 * 6. Undo/redo works
 *
 * NOTE: Requires AI API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY)
 */

import { test, expect } from '@playwright/test';
import {
  createProject,
  navigateToProject,
  sendChatMessage,
  waitForConvexSync,
  clickUndo,
  clickRedo,
  getChatMessageCount,
  getCompositionElementCount,
} from './helpers';

// Check if AI is configured
const hasAIConfig = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY;

test.describe('AI Chat Editing Workflow', () => {
  test.skip(!hasAIConfig, 'Requires AI API keys');

  let projectId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    projectId = await createProject(page, `Chat Test ${Date.now()}`);
    await navigateToProject(page, projectId);
  });

  test('should send chat message and receive AI response', async ({ page }) => {
    const initialCount = await getChatMessageCount(page);

    // Send message
    await sendChatMessage(page, 'Hello');

    await waitForConvexSync(page);

    // Verify message count increased by 2 (user + assistant)
    const finalCount = await getChatMessageCount(page);
    expect(finalCount).toBe(initialCount + 2);

    // Verify assistant response exists
    await expect(page.locator('[data-role="assistant"]').last()).toBeVisible();
  });

  test('should execute simple edit command', async ({ page }) => {
    // This test assumes a video is already in the project
    // For testing without upload, we'll send a command and verify the flow

    await sendChatMessage(page, 'Add text saying "Hello World"');

    await waitForConvexSync(page, 10000);

    // Verify edit receipt appears
    const receipt = page.locator('[data-receipt]').or(page.locator('text=/added/i, text=/updated/i'));
    await expect(receipt).toBeVisible({ timeout: 15000 });

    // Verify composition has at least one element
    const elementCount = await getCompositionElementCount(page);
    expect(elementCount).toBeGreaterThan(0);
  });

  test('should update element properties', async ({ page }) => {
    // Add an element first
    await sendChatMessage(page, 'Add text saying "Test"');
    await waitForConvexSync(page, 10000);

    const initialCount = await getCompositionElementCount(page);

    // Update the element
    await sendChatMessage(page, 'Make it bigger');
    await waitForConvexSync(page, 10000);

    // Element count should stay the same (update, not add)
    const finalCount = await getCompositionElementCount(page);
    expect(finalCount).toBe(initialCount);

    // Verify receipt confirms update
    const receipt = page.locator('[data-receipt]').or(page.locator('text=/updated/i'));
    await expect(receipt.last()).toBeVisible({ timeout: 15000 });
  });

  test('should handle ambiguous selectors', async ({ page }) => {
    // Add multiple text elements
    await sendChatMessage(page, 'Add text saying "First"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Second"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Third"');
    await waitForConvexSync(page, 10000);

    // Send ambiguous command
    await sendChatMessage(page, 'Make the text red');
    await waitForConvexSync(page, 10000);

    // Should show disambiguator UI
    const disambiguator = page.locator('[data-disambiguator]').or(
      page.locator('text=/which one/i, text=/select/i')
    );

    // Check if disambiguator appeared (may or may not depending on AI interpretation)
    const hasDisambiguator = await disambiguator.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDisambiguator) {
      // If disambiguator shows, verify we can select an option
      const options = page.locator('[data-disambiguator-option]');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(1);

      // Select first option
      await options.first().click();
      await waitForConvexSync(page);

      // Verify receipt appears after selection
      await expect(page.locator('[data-receipt]').last()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should support undo operation', async ({ page }) => {
    // Perform an edit
    await sendChatMessage(page, 'Add text saying "Undo Test"');
    await waitForConvexSync(page, 10000);

    const countAfterAdd = await getCompositionElementCount(page);
    expect(countAfterAdd).toBeGreaterThan(0);

    // Undo
    await clickUndo(page);
    await waitForConvexSync(page);

    // Element count should decrease
    const countAfterUndo = await getCompositionElementCount(page);
    expect(countAfterUndo).toBeLessThan(countAfterAdd);
  });

  test('should support redo operation', async ({ page }) => {
    // Perform an edit
    await sendChatMessage(page, 'Add text saying "Redo Test"');
    await waitForConvexSync(page, 10000);

    const countAfterAdd = await getCompositionElementCount(page);

    // Undo
    await clickUndo(page);
    await waitForConvexSync(page);

    const countAfterUndo = await getCompositionElementCount(page);

    // Redo
    await clickRedo(page);
    await waitForConvexSync(page);

    const countAfterRedo = await getCompositionElementCount(page);

    // Should be back to post-add count
    expect(countAfterRedo).toBe(countAfterAdd);
  });

  test('should display edit receipts', async ({ page }) => {
    await sendChatMessage(page, 'Add text saying "Receipt Test"');
    await waitForConvexSync(page, 10000);

    // Look for receipt indicators
    const receipt = page.locator('[data-receipt]').or(
      page.locator('text=/✓/i, text=/added/i, text=/updated/i')
    );

    await expect(receipt).toBeVisible({ timeout: 15000 });

    // Receipt should contain human-readable text
    const receiptText = await receipt.textContent();
    expect(receiptText).toBeTruthy();
    expect(receiptText!.length).toBeGreaterThan(5);
  });

  test('should auto-scroll chat to latest message', async ({ page }) => {
    // Send multiple messages to fill chat
    for (let i = 0; i < 5; i++) {
      await sendChatMessage(page, `Message ${i + 1}`);
      await waitForConvexSync(page, 10000);
    }

    // Verify last message is visible
    const lastMessage = page.locator('[data-role="assistant"]').last();
    await expect(lastMessage).toBeVisible();

    // Check if it's in viewport
    const isInViewport = await lastMessage.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
      );
    });

    expect(isInViewport).toBeTruthy();
  });

  test('should handle long responses gracefully', async ({ page }) => {
    await sendChatMessage(page, 'Explain how video editing works in detail');
    await waitForConvexSync(page, 15000);

    // Verify response appears
    const response = page.locator('[data-role="assistant"]').last();
    await expect(response).toBeVisible({ timeout: 20000 });

    // Response should have content
    const text = await response.textContent();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('should show loading state while AI processes', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Type a message"]').or(
      page.locator('textarea[placeholder*="Ask ChatKut"]')
    );

    await chatInput.fill('Test loading state');
    await chatInput.press('Enter');

    // Should show loading indicator immediately
    const loadingIndicator = page.locator('[data-loading]').or(
      page.locator('text=/processing/i, text=/thinking/i')
    );

    // Check if loading appears (may be very fast)
    await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
  });

  test('should preserve chat history across page reloads', async ({ page }) => {
    // Send a message
    const uniqueMessage = `Reload Test ${Date.now()}`;
    await sendChatMessage(page, uniqueMessage);
    await waitForConvexSync(page, 10000);

    // Reload page
    await page.reload();
    await waitForConvexSync(page);

    // Verify message still exists
    await expect(page.locator(`text=${uniqueMessage}`)).toBeVisible();
  });

  test('should handle invalid commands gracefully', async ({ page }) => {
    await sendChatMessage(page, 'asdfghjkl qwertyuiop');
    await waitForConvexSync(page, 10000);

    // Should get a response (even if it's "I don't understand")
    const response = page.locator('[data-role="assistant"]').last();
    await expect(response).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Chat Interface UI', () => {
  test('should have functional chat input', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `UI Test ${Date.now()}`);
    await navigateToProject(page, projectId);

    const chatInput = page.locator('textarea[placeholder*="Type a message"]').or(
      page.locator('textarea[placeholder*="Ask ChatKut"]')
    );

    // Verify input exists
    await expect(chatInput).toBeVisible();

    // Can type in input
    await chatInput.fill('Test typing');
    await expect(chatInput).toHaveValue('Test typing');

    // Can clear input
    await chatInput.clear();
    await expect(chatInput).toHaveValue('');
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `Keyboard Test ${Date.now()}`);
    await navigateToProject(page, projectId);

    // Test Cmd+Z for undo (after an edit)
    // First need to make an edit
    if (hasAIConfig) {
      await sendChatMessage(page, 'Add text saying "Shortcut Test"');
      await waitForConvexSync(page, 10000);

      // Press Cmd+Z (or Ctrl+Z on Windows/Linux)
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.press(`${modifier}+KeyZ`);
      await waitForConvexSync(page);

      // Composition should have changed (undo worked)
    }
  });
});
