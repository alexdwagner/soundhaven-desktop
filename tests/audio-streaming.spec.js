const { test, expect } = require('@playwright/test');

test.describe('Audio Streaming API', () => {
  const BASE_URL = 'http://localhost:3001';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should handle audio streaming requests without params errors', async ({ page }) => {
    // Monitor console errors - Next.js params errors show up in browser console
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Intercept network errors
    const networkErrors = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Try to play audio - this should trigger audio API calls
    // Look for play button or audio elements
    const playButton = page.locator('button[aria-label*="play"], button[title*="play"], button:has-text("play")', { timeout: 5000 }).first();
    
    if (await playButton.isVisible()) {
      console.log('Found play button, clicking...');
      await playButton.click();
      
      // Wait for audio requests
      await page.waitForTimeout(2000);
    } else {
      // Manually trigger an audio request to test the API
      console.log('No play button found, testing API directly...');
      
      // Get a track ID from the database/UI
      const trackElement = page.locator('[data-track-id]').first();
      if (await trackElement.isVisible()) {
        const trackId = await trackElement.getAttribute('data-track-id');
        
        // Make direct audio request
        const response = await page.request.get(`${BASE_URL}/api/audio/${trackId}`);
        console.log('Direct audio API response:', response.status());
      }
    }

    // Check for Next.js params errors
    const paramsErrors = consoleErrors.filter(error => 
      error.includes('params should be awaited') || 
      error.includes('sync-dynamic-apis')
    );

    // Verify no params-related errors occurred
    expect(paramsErrors).toHaveLength(0);
    
    if (paramsErrors.length > 0) {
      console.log('❌ Found params errors:', paramsErrors);
    } else {
      console.log('✅ No params errors detected');
    }
  });

  test('should successfully stream audio when track exists', async ({ page }) => {
    // Test with a known track ID (from database)
    const testTrackId = 'c37a62da-71b0-48e4-a22e-ce854276268d'; // Careless Whisper from logs

    // Make audio streaming request
    const response = await page.request.get(`${BASE_URL}/api/audio/${testTrackId}`);
    
    // Should get successful response (200 or 206 for partial content)
    expect([200, 206]).toContain(response.status());
    
    // Should have audio content type
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('audio');
    
    console.log('✅ Audio streaming working:', {
      status: response.status(),
      contentType,
      contentLength: response.headers()['content-length']
    });
  });

  test('should handle non-existent track gracefully', async ({ page }) => {
    const fakeTrackId = 'fake-track-id-that-does-not-exist';

    const response = await page.request.get(`${BASE_URL}/api/audio/${fakeTrackId}`);
    
    // Should return 404 for non-existent track
    expect(response.status()).toBe(404);
    
    const responseData = await response.json();
    expect(responseData.error).toBeTruthy();
    
    console.log('✅ Non-existent track handled correctly:', responseData);
  });

  test('should support range requests for audio streaming', async ({ page }) => {
    const testTrackId = 'c37a62da-71b0-48e4-a22e-ce854276268d';

    // Make range request (common for audio players)
    const response = await page.request.get(`${BASE_URL}/api/audio/${testTrackId}`, {
      headers: {
        'Range': 'bytes=0-1023'
      }
    });
    
    // Should return 206 Partial Content
    expect(response.status()).toBe(206);
    
    // Should have proper range headers
    const headers = response.headers();
    expect(headers['accept-ranges']).toBe('bytes');
    expect(headers['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);
    
    console.log('✅ Range requests working:', {
      status: response.status(),
      contentRange: headers['content-range'],
      contentLength: headers['content-length']
    });
  });
});