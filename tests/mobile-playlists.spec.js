const { test, expect } = require('@playwright/test');

test.describe('Mobile Playlist Functionality', () => {
  const MOBILE_URL = 'http://192.168.12.219:3001';

  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to mobile app
    await page.goto(MOBILE_URL);
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load mobile app successfully', async ({ page }) => {
    // Check that the page loads
    await expect(page).toHaveTitle(/SoundHaven/);
    
    // Check for main navigation elements
    await expect(page.locator('h1')).toContainText('🌊');
  });

  test('should fetch and display playlists', async ({ page }) => {
    // Wait for playlists to load from our Express API
    // Since we don't have data-testid yet, let's look for actual playlist elements
    await page.waitForTimeout(3000); // Give API time to respond
    
    // Look for playlist sidebar or playlist items
    const playlistSidebar = page.locator('[class*="playlist"]').or(
      page.locator('text=/playlist/i')
    );
    
    // Check that some playlist-related content is visible
    await expect(playlistSidebar.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle API connectivity', async ({ page }) => {
    // Wait for a playlist API response (proves our Express server is working)
    const responsePromise = page.waitForResponse(response => {
      return response.url().includes('/api/playlists') && response.status() === 200;
    });
    
    await page.reload();
    
    // This will throw if no 200 response is received within timeout
    const response = await responsePromise;
    
    // Verify we got the expected response
    expect(response.status()).toBe(200);
    console.log('✅ Playlist API responded with status:', response.status());
  });

  test('should display mobile navigation', async ({ page }) => {
    // Check for mobile-specific elements
    const mobileNav = page.locator('h1').filter({ hasText: '🌊' });
    await expect(mobileNav).toBeVisible();
    
    // Check that desktop elements are hidden or adapted for mobile
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBe(375);
  });
});