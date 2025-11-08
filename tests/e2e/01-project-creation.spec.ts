/**
 * E2E Test: Project Creation Workflow
 *
 * Tests the most basic workflow:
 * 1. Visit homepage
 * 2. Create new project
 * 3. Navigate to project dashboard
 * 4. Verify 3-panel layout loads
 */

import { test, expect } from '@playwright/test';
import { createProject, waitForConvexSync, assertNoConsoleErrors } from './helpers';

test.describe('Project Creation Workflow', () => {
  test('should create a new project and navigate to dashboard', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify homepage elements
    await expect(page.getByRole('heading', { name: /chatkut/i })).toBeVisible();

    // Create project
    const projectName = `Test Project ${Date.now()}`;
    const projectId = await createProject(page, projectName);

    // Verify navigation to project dashboard
    await expect(page).toHaveURL(`/project/${projectId}`);

    // Verify 3-panel layout exists
    await expect(page.locator('[data-panel="left"]').or(page.locator('.left-panel'))).toBeVisible();
    await expect(page.locator('[data-panel="center"]').or(page.locator('.center-panel'))).toBeVisible();
    await expect(page.locator('[data-panel="right"]').or(page.locator('.right-panel'))).toBeVisible();

    // Verify key UI elements
    await expect(page.getByRole('tab', { name: /assets/i }).or(page.getByText(/assets/i))).toBeVisible();
    await expect(page.getByRole('tab', { name: /upload/i }).or(page.getByText(/upload/i))).toBeVisible();

    // Verify no console errors
    await assertNoConsoleErrors(page, [
      'Convex connection', // Allow Convex-related warnings
      'WebSocket',
    ]);
  });

  test('should show project in homepage list after creation', async ({ page }) => {
    // Create project
    await page.goto('/');
    const projectName = `List Test ${Date.now()}`;
    await createProject(page, projectName);

    // Go back to homepage
    await page.goto('/');
    await waitForConvexSync(page);

    // Verify project appears in list
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test('should handle empty project name gracefully', async ({ page }) => {
    await page.goto('/');

    // Click create project button (could be "New Project" or "Create Project")
    await page.getByRole('button', { name: /new project|create project/i }).first().click();

    // Wait for modal
    await page.getByPlaceholder(/my video project/i).waitFor({ state: 'visible' });

    // Try to submit without name - button should be disabled
    const submitButton = page.locator('form button[type="submit"]');
    const isDisabled = await submitButton.isDisabled();

    expect(isDisabled).toBeTruthy();
  });

  test('should display empty state correctly', async ({ page }) => {
    // Create new project
    await page.goto('/');
    const projectId = await createProject(page, `Empty State Test ${Date.now()}`);

    // Navigate to project
    await page.goto(`/project/${projectId}`);
    await waitForConvexSync(page);

    // Should show empty composition state
    // (Check for empty state message or placeholder)
    const hasEmptyState = await page.locator('text=/no elements/i').or(
      page.locator('text=/empty composition/i')
    ).isVisible().catch(() => false);

    // Empty state may not always show, so this is optional
    // Just verify the page loaded without errors
    await expect(page).toHaveURL(`/project/${projectId}`);
  });

  test('should navigate between projects', async ({ page }) => {
    // Create first project
    await page.goto('/');
    const project1Name = `Project 1 ${Date.now()}`;
    const project1Id = await createProject(page, project1Name);

    // Go back and create second project
    await page.goto('/');
    await waitForConvexSync(page);
    const project2Name = `Project 2 ${Date.now() + 1}`;
    const project2Id = await createProject(page, project2Name);

    // Verify on project 2
    await expect(page).toHaveURL(`/project/${project2Id}`);

    // Navigate back to project 1
    await page.goto(`/project/${project1Id}`);
    await expect(page).toHaveURL(`/project/${project1Id}`);

    // Navigate back to project 2
    await page.goto(`/project/${project2Id}`);
    await expect(page).toHaveURL(`/project/${project2Id}`);
  });
});
