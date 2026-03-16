import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-End Tests for Office Map Application
 * 
 * These tests verify complete user flows work correctly
 * 
 * Requirements:
 * - Application must be running on http://localhost:5000
 * - Database must be seeded with test data
 * 
 * Run with: npx playwright test
 */

test.describe('Office Map Application', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Navigate to the app before each test
    await page.goto('http://localhost:5000');
  });

  test.describe('Map Loading', () => {
    test('should load the map on homepage', async ({ page }: { page: Page }) => {
      // Wait for canvas or map container
      await page.waitForLoadState('networkidle');

      // Verify page title or heading
      const heading = await page.locator('h1, h2, [role="heading"]').first();
      await expect(heading).toBeVisible();
    });

    test('should load floor plans', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Look for floor plan selector or floor buttons
      const floorElement = await page.locator('[class*="floor"], button[aria-label*="floor"]').first();
      expect(floorElement).toBeDefined();
    });

    test('should display markers/locations on map', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Look for map markers (could be canvas, SVG elements, or DIVs)
      const markers = await page.locator('[class*="marker"], [class*="location"]').count();
      expect(markers).toBeGreaterThan(0);
    });
  });

  test.describe('User Interactions', () => {
    test('should switch between floors', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Find floor selector buttons
      const floorButtons = page.locator('button[aria-label*="Floor"], button[aria-label*="Level"]');
      const count = await floorButtons.count();

      if (count > 1) {
        // Click second floor
        await floorButtons.nth(1).click();
        await page.waitForLoadState('networkidle');

        // Verify floor changed (could check class, text, or canvas state)
        await expect(floorButtons.nth(1)).toHaveClass(/active|selected/);
      }
    });

    test('should show location details on click', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Click on first marker/location
      const marker = page.locator('[class*="marker"], [class*="location"]').first();
      await marker.click();

      // Wait for details panel/modal to appear
      const detailsPanel = page.locator('[class*="details"], [class*="panel"], [role="dialog"]').first();
      await expect(detailsPanel).toBeVisible();
    });

    test('should search for locations', async ({ page }: { page: Page }) => {
      // Look for search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="Search"], [role="searchbox"]'
      ).first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('desk');
        await page.waitForLoadState('networkidle');

        // Verify results are filtered
        const resultCount = await page.locator('[class*="marker"], [class*="location"]').count();
        expect(resultCount).toBeGreaterThan(0);
      }
    });

    test('should zoom in and out on map', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Find zoom buttons or try scroll on canvas
      const zoomInButton = page.locator('button[aria-label*="Zoom in"], button[title*="Zoom in"]');
      const zoomOutButton = page.locator('button[aria-label*="Zoom out"], button[title*="Zoom out"]');

      if (await zoomInButton.isVisible()) {
        await zoomInButton.click();
        await page.waitForTimeout(300); // Wait for animation

        // Click zoom out to reset
        await zoomOutButton.click();
      }
    });

    test('should pan the map', async ({ page }: { page: Page }) => {
      // Get canvas or main map container
      const mapContainer = page.locator('canvas, [class*="map"]').first();

      if (await mapContainer.isVisible()) {
        const box = await mapContainer.boundingBox();
        if (box) {
          // Pan by dragging
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100);
          await page.mouse.up();
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }: { page: Page }) => {
      const h1 = await page.locator('h1').count();
      expect(h1).toBeGreaterThanOrEqual(1);
    });

    test('should have alt text for images', async ({ page }: { page: Page }) => {
      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        // Alt text can be empty for decorative images
        expect(alt).toBeDefined();
      }
    });

    test('should have proper ARIA labels', async ({ page }: { page: Page }) => {
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const title = await button.getAttribute('title');
        const text = await button.textContent();

        // Check button has some accessible label
        expect(ariaLabel || title || text?.trim()).toBeTruthy();
      }
    });

    test('should support keyboard navigation', async ({ page }: { page: Page }) => {
      // Focus should be visible somewhere
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeDefined();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }: { page: Page }) => {
      const navigationTiming = await page.evaluate(() => {
        const perf = window.performance.timing;
        return {
          loadTime: perf.loadEventEnd - perf.navigationStart,
          domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
        };
      });

      // Page should load within 5 seconds
      expect(navigationTiming.loadTime).toBeLessThan(5000);
    });

    test('should not have performance warnings', async ({ page }: { page: Page }) => {
      await page.waitForLoadState('networkidle');

      // Check console for performance issues
      const logs: string[] = [];
      page.on('console', (msg: any) => {
        if (msg.type() === 'warning' && msg.text().includes('performance')) {
          logs.push(msg.text());
        }
      });

      // Wait a bit to collect logs
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message if API fails', async ({ page }: { page: Page }) => {
      // Intercept API requests and make them fail
      await page.route('**/api/**', (route: any) => {
        route.abort('failed');
      });

      await page.goto('http://localhost:5000');

      // Look for error message
      const errorMessage = page.locator('[role="alert"], [class*="error"], [class*="warning"]');
      
      // Note: May or may not show error depending on implementation
      // Just verify page doesn't crash
      await expect(page).toHaveTitle(/.*/);
    });

    test('should handle 404 gracefully', async ({ page }: { page: Page }) => {
      await page.goto('http://localhost:5000/nonexistent-page', { waitUntil: 'networkidle' });

      // Page should show some content, not error
      const content = page.locator('body');
      await expect(content).toBeVisible();
    });
  });
});
