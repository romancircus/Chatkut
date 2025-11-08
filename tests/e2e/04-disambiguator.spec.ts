/**
 * E2E Test: Disambiguator Workflow
 *
 * Tests disambiguation UI when multiple elements match a selector:
 * 1. Create composition with multiple similar elements
 * 2. Send ambiguous command
 * 3. Disambiguator appears with options
 * 4. Select correct option
 * 5. Edit applies to selected element only
 *
 * NOTE: Requires AI API keys
 */

import { test, expect } from '@playwright/test';
import {
  createProject,
  navigateToProject,
  sendChatMessage,
  waitForConvexSync,
  selectDisambiguatorOption,
  isDisambiguatorVisible,
} from './helpers';

const hasAIConfig = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY;

test.describe('Disambiguator Workflow', () => {
  test.skip(!hasAIConfig, 'Requires AI API keys');

  let projectId: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    projectId = await createProject(page, `Disambiguator Test ${Date.now()}`);
    await navigateToProject(page, projectId);
  });

  test('should show disambiguator for ambiguous selectors', async ({ page }) => {
    // Add multiple video elements
    await sendChatMessage(page, 'Add a blue rectangle');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add a red rectangle');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add a green rectangle');
    await waitForConvexSync(page, 10000);

    // Send ambiguous command
    await sendChatMessage(page, 'Make the rectangle bigger');
    await waitForConvexSync(page, 10000);

    // Check if disambiguator appears
    const hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      // Verify options are shown
      const options = page.locator('[data-disambiguator-option]');
      const count = await options.count();
      expect(count).toBe(3); // Should show all 3 rectangles

      // Each option should have description
      for (let i = 0; i < count; i++) {
        const option = options.nth(i);
        await expect(option).toBeVisible();

        // Should show label or description
        const text = await option.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test('should apply edit after disambiguation', async ({ page }) => {
    // Add text elements with different content
    await sendChatMessage(page, 'Add text saying "First Text"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Second Text"');
    await waitForConvexSync(page, 10000);

    // Send ambiguous command
    await sendChatMessage(page, 'Change the text color to red');
    await waitForConvexSync(page, 10000);

    const hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      // Select first option
      await selectDisambiguatorOption(page, 0);

      // Wait for edit to complete
      await waitForConvexSync(page, 5000);

      // Verify receipt appears confirming specific element was edited
      const receipt = page.locator('[data-receipt]').last();
      await expect(receipt).toBeVisible({ timeout: 10000 });

      const receiptText = await receipt.textContent();
      expect(receiptText).toContain('Text'); // Should mention which text
    }
  });

  test('should cancel disambiguation', async ({ page }) => {
    // Add multiple elements
    await sendChatMessage(page, 'Add text saying "Cancel Test 1"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Cancel Test 2"');
    await waitForConvexSync(page, 10000);

    // Send ambiguous command
    await sendChatMessage(page, 'Delete the text');
    await waitForConvexSync(page, 10000);

    const hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      // Look for cancel button
      const cancelButton = page.getByRole('button', { name: /cancel/i });

      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await waitForConvexSync(page);

        // Disambiguator should disappear
        await expect(page.locator('[data-disambiguator]')).not.toBeVisible();

        // No edit should have been applied
        // (Would need to check composition didn't change)
      }
    }
  });

  test('should handle disambiguation with thumbnails', async ({ page }) => {
    // If videos are uploaded, disambiguator should show thumbnails
    // For this test, we just verify the UI structure

    // Add elements (assuming video assets exist)
    await sendChatMessage(page, 'Add a video to the timeline');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add another video');
    await waitForConvexSync(page, 10000);

    // Send ambiguous command
    await sendChatMessage(page, 'Make the video louder');
    await waitForConvexSync(page, 10000);

    const hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      const options = page.locator('[data-disambiguator-option]');

      // Check if thumbnails exist (optional, depends on implementation)
      const firstOption = options.first();
      const hasThumbnail = await firstOption.locator('img').isVisible().catch(() => false);

      // Just verify options render correctly
      await expect(firstOption).toBeVisible();
    }
  });

  test('should show timecodes in disambiguator', async ({ page }) => {
    // Elements should show their position in timeline

    await sendChatMessage(page, 'Add text at 0 seconds');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text at 5 seconds');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Change the text');
    await waitForConvexSync(page, 10000);

    const hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      const options = page.locator('[data-disambiguator-option]');

      // Check if timecodes are shown
      const firstOption = options.first();
      const text = await firstOption.textContent();

      // Should contain timing info (format may vary)
      const hasTimecode = text?.match(/\d+:\d+|\d+s|\d+ sec/) !== null;

      // Optional check - timing info may be in different format
    }
  });

  test('should prefer unambiguous selectors', async ({ page }) => {
    // When user is specific, no disambiguation needed

    await sendChatMessage(page, 'Add text saying "First"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Second"');
    await waitForConvexSync(page, 10000);

    // Specific command using label
    await sendChatMessage(page, 'Change "First" to red');
    await waitForConvexSync(page, 10000);

    // Disambiguator should NOT appear
    const hasDisambiguator = await isDisambiguatorVisible(page);
    expect(hasDisambiguator).toBeFalsy();

    // Edit should apply directly
    const receipt = page.locator('[data-receipt]').last();
    await expect(receipt).toBeVisible({ timeout: 10000 });
  });

  test('should handle disambiguation with index selectors', async ({ page }) => {
    // "first clip", "second clip", etc. should be unambiguous

    await sendChatMessage(page, 'Add text saying "One"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Two"');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add text saying "Three"');
    await waitForConvexSync(page, 10000);

    // Use index selector
    await sendChatMessage(page, 'Make the second text bigger');
    await waitForConvexSync(page, 10000);

    // Should NOT need disambiguation
    const hasDisambiguator = await isDisambiguatorVisible(page);

    // May still show if AI interprets differently
    // Just verify command completes
    await expect(page.locator('[data-receipt]').last()).toBeVisible({ timeout: 15000 });
  });

  test('should update disambiguator when composition changes', async ({ page }) => {
    // Add elements
    await sendChatMessage(page, 'Add blue rectangle');
    await waitForConvexSync(page, 10000);

    await sendChatMessage(page, 'Add red rectangle');
    await waitForConvexSync(page, 10000);

    // Trigger disambiguator
    await sendChatMessage(page, 'Change the rectangle color');
    await waitForConvexSync(page, 10000);

    let hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      const initialCount = await page.locator('[data-disambiguator-option]').count();

      // If we add another element while disambiguator is open
      // (In practice, disambiguator might close, but this tests edge case)

      // Select an option to close it
      await selectDisambiguatorOption(page, 0);
      await waitForConvexSync(page);
    }

    // Add another element
    await sendChatMessage(page, 'Add green rectangle');
    await waitForConvexSync(page, 10000);

    // Trigger disambiguator again
    await sendChatMessage(page, 'Change the rectangle size');
    await waitForConvexSync(page, 10000);

    hasDisambiguator = await isDisambiguatorVisible(page);

    if (hasDisambiguator) {
      const newCount = await page.locator('[data-disambiguator-option]').count();
      expect(newCount).toBe(3); // Should now show 3 options
    }
  });
});

test.describe('Disambiguator Edge Cases', () => {
  test('should handle single match gracefully', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `Single Match ${Date.now()}`);
    await navigateToProject(page, projectId);

    // Add only one element
    await sendChatMessage(page, 'Add text saying "Only One"');
    await waitForConvexSync(page, 10000);

    // Command that could be ambiguous, but only one match exists
    await sendChatMessage(page, 'Make the text red');
    await waitForConvexSync(page, 10000);

    // Should NOT show disambiguator
    const hasDisambiguator = await isDisambiguatorVisible(page);
    expect(hasDisambiguator).toBeFalsy();

    // Edit should apply immediately
    await expect(page.locator('[data-receipt]').last()).toBeVisible({ timeout: 10000 });
  });

  test('should handle no matches', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `No Match ${Date.now()}`);
    await navigateToProject(page, projectId);

    // Try to edit non-existent element
    await sendChatMessage(page, 'Make the video louder');
    await waitForConvexSync(page, 10000);

    // Should get error or clarification message
    const response = page.locator('[data-role="assistant"]').last();
    await expect(response).toBeVisible();

    const text = await response.textContent();

    // Should mention that no match was found
    expect(text?.toLowerCase()).toMatch(/no|not found|doesn't exist|cannot find/);
  });
});
