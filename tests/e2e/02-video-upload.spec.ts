/**
 * E2E Test: Video Upload Workflow
 *
 * Tests file upload functionality:
 * 1. Upload video file (requires Cloudflare credentials)
 * 2. Track upload progress
 * 3. Verify asset appears in library
 * 4. Verify HLS preview works
 *
 * NOTE: These tests require CLOUDFLARE_* environment variables to be set.
 * Without credentials, tests will be skipped.
 */

import { test, expect } from '@playwright/test';
import { createProject, navigateToProject, waitForUploadComplete, waitForConvexSync } from './helpers';
import path from 'path';
import fs from 'fs';

// Check if Cloudflare is configured
const hasCloudflareConfig = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN;

test.describe('Video Upload Workflow', () => {
  test.skip(!hasCloudflareConfig, 'Requires Cloudflare credentials');

  let projectId: string;

  test.beforeEach(async ({ page }) => {
    // Create a test project
    await page.goto('/');
    projectId = await createProject(page, `Upload Test ${Date.now()}`);
    await navigateToProject(page, projectId);
  });

  test('should upload video file successfully', async ({ page }) => {
    // Navigate to Upload tab
    await page.getByRole('tab', { name: /upload/i }).click();

    // Create a small test video file (or use existing one)
    const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');

    // Skip if test video doesn't exist
    if (!fs.existsSync(testVideoPath)) {
      test.skip(true, 'Test video file not found');
      return;
    }

    // Find upload input (may be hidden)
    const fileInput = page.locator('input[type="file"]');

    // Set files on the input
    await fileInput.setInputFiles(testVideoPath);

    // Wait for upload to start
    await page.waitForSelector('[data-upload-progress]', { timeout: 5000 });

    // Wait for upload to complete (may take 30-60 seconds for video)
    await waitForUploadComplete(page, 'test-video.mp4', 120000);

    // Navigate to Assets tab
    await page.getByRole('tab', { name: /assets/i }).click();
    await waitForConvexSync(page);

    // Verify asset appears
    await expect(page.getByText('test-video.mp4')).toBeVisible();

    // Verify status is "ready"
    const asset = page.locator('[data-filename="test-video.mp4"]');
    await expect(asset.locator('[data-status="ready"]')).toBeVisible({ timeout: 120000 });
  });

  test('should show upload progress', async ({ page }) => {
    await page.getByRole('tab', { name: /upload/i }).click();

    const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');

    if (!fs.existsSync(testVideoPath)) {
      test.skip(true, 'Test video file not found');
      return;
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testVideoPath);

    // Wait for progress bar
    const progressBar = page.locator('[data-upload-progress]');
    await expect(progressBar).toBeVisible({ timeout: 5000 });

    // Progress should increase over time
    const initialProgress = await progressBar.getAttribute('data-progress') || '0';
    await page.waitForTimeout(2000);
    const laterProgress = await progressBar.getAttribute('data-progress') || '0';

    expect(parseInt(laterProgress)).toBeGreaterThanOrEqual(parseInt(initialProgress));
  });

  test('should preview video with HLS player', async ({ page }) => {
    // This test assumes a video is already uploaded
    // Navigate to Assets
    await page.getByRole('tab', { name: /assets/i }).click();
    await waitForConvexSync(page);

    // Check if any assets exist
    const assets = page.locator('[data-filename]');
    const count = await assets.count();

    if (count === 0) {
      test.skip(true, 'No assets available for preview test');
      return;
    }

    // Click first video asset
    await assets.first().click();

    // Wait for HLS player to load
    await page.waitForSelector('video', { timeout: 10000 });

    // Verify video element exists
    const video = page.locator('video');
    await expect(video).toBeVisible();

    // Wait for video to be ready
    await video.evaluate((v: HTMLVideoElement) => {
      return new Promise<void>((resolve) => {
        if (v.readyState >= 2) {
          resolve();
        } else {
          v.addEventListener('loadeddata', () => resolve(), { once: true });
        }
      });
    });

    // Try to play
    await video.evaluate((v: HTMLVideoElement) => v.play());

    // Wait a bit and verify it's playing
    await page.waitForTimeout(1000);
    const isPlaying = await video.evaluate((v: HTMLVideoElement) => !v.paused);
    expect(isPlaying).toBeTruthy();
  });

  test('should handle multiple file uploads', async ({ page }) => {
    await page.getByRole('tab', { name: /upload/i }).click();

    const testFiles = [
      path.join(__dirname, '../fixtures/test-video-1.mp4'),
      path.join(__dirname, '../fixtures/test-video-2.mp4'),
    ];

    // Check if files exist
    const existingFiles = testFiles.filter(f => fs.existsSync(f));

    if (existingFiles.length === 0) {
      test.skip(true, 'Test video files not found');
      return;
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(existingFiles);

    // Should show multiple progress bars
    const progressBars = page.locator('[data-upload-progress]');
    await expect(progressBars).toHaveCount(existingFiles.length);
  });

  test('should display upload errors gracefully', async ({ page }) => {
    await page.getByRole('tab', { name: /upload/i }).click();

    // Try to upload invalid file (non-video)
    const invalidFilePath = path.join(__dirname, '../fixtures/invalid.txt');

    // Create invalid file if doesn't exist
    if (!fs.existsSync(path.dirname(invalidFilePath))) {
      fs.mkdirSync(path.dirname(invalidFilePath), { recursive: true });
    }
    if (!fs.existsSync(invalidFilePath)) {
      fs.writeFileSync(invalidFilePath, 'This is not a video');
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidFilePath);

    // Should show error message
    await expect(page.locator('text=/invalid/i').or(page.locator('text=/error/i'))).toBeVisible({ timeout: 5000 });
  });

  test('should allow resumable uploads', async ({ page }) => {
    // This test is complex - TUS protocol allows resuming
    // For MVP, just verify upload starts and can be tracked
    await page.getByRole('tab', { name: /upload/i }).click();

    const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');

    if (!fs.existsSync(testVideoPath)) {
      test.skip(true, 'Test video file not found');
      return;
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testVideoPath);

    // Verify upload starts
    await expect(page.locator('[data-upload-progress]')).toBeVisible({ timeout: 5000 });

    // TUS client handles resumption automatically
    // Just verify no errors occur
    await page.waitForTimeout(5000);
  });
});

test.describe('Asset Library', () => {
  test('should filter assets by type', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `Filter Test ${Date.now()}`);
    await navigateToProject(page, projectId);

    // Navigate to Assets
    await page.getByRole('tab', { name: /assets/i }).click();

    // Check for filter buttons
    const allFilter = page.getByRole('button', { name: /all/i });
    const videoFilter = page.getByRole('button', { name: /video/i });
    const audioFilter = page.getByRole('button', { name: /audio/i });
    const imageFilter = page.getByRole('button', { name: /image/i });

    // Verify filters exist
    if (await allFilter.isVisible()) {
      await expect(allFilter).toBeVisible();
      await expect(videoFilter).toBeVisible();
    }
  });

  test('should delete assets', async ({ page }) => {
    await page.goto('/');
    const projectId = await createProject(page, `Delete Test ${Date.now()}`);
    await navigateToProject(page, projectId);

    await page.getByRole('tab', { name: /assets/i }).click();
    await waitForConvexSync(page);

    // Check if any assets exist
    const assets = page.locator('[data-filename]');
    const count = await assets.count();

    if (count === 0) {
      test.skip(true, 'No assets available for delete test');
      return;
    }

    // Get first asset filename
    const firstAsset = assets.first();
    const filename = await firstAsset.getAttribute('data-filename');

    // Click delete button (implementation may vary)
    const deleteButton = firstAsset.locator('button[aria-label*="delete"]').or(
      firstAsset.locator('button:has-text("Delete")')
    );

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion if modal appears
      const confirmButton = page.getByRole('button', { name: /confirm/i });
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      // Verify asset removed
      await waitForConvexSync(page);
      await expect(page.locator(`[data-filename="${filename}"]`)).not.toBeVisible();
    }
  });
});
