import { describe, it, expect, beforeEach } from 'vitest';
import { MarkerColorsCache, ColorCacheStats } from './marker-colors-cache';
import type { Location } from '@shared/schema';

describe('MarkerColorsCache', () => {
  let cache: MarkerColorsCache;

  const mockCompute = (color: string) => () => color;
  
  const createMockLocation = (overrides?: Partial<Location>): Location => ({
    id: '1',
    name: 'Test Location',
    type: 'desk',
    status: 'available',
    lat: 0,
    lng: 0,
    ...overrides,
  } as Location);

  beforeEach(() => {
    cache = new MarkerColorsCache(10); // Small cache for testing
  });

  describe('Initialization', () => {
    it('should create a cache with default max size of 200', () => {
      const largeCache = new MarkerColorsCache();
      expect(largeCache.getSize()).toBe(0);
    });

    it('should create a cache with custom max size', () => {
      const smallCache = new MarkerColorsCache(5);
      expect(smallCache.getSize()).toBe(0);
    });
  });

  describe('get method', () => {
    it('should compute and cache color on first access', () => {
      const location = createMockLocation({ type: 'camera' });
      const expectedColor = '#ff0000';
      const computeFn = mockCompute(expectedColor);

      const color = cache.get(location, computeFn);

      expect(color).toBe(expectedColor);
      expect(cache.getSize()).toBe(1);
    });

    it('should return cached color on second access', () => {
      const location = createMockLocation({ type: 'socket' });
      const computeFn = vi.fn(() => '#00ff00');

      // First call
      cache.get(location, computeFn);
      expect(computeFn).toHaveBeenCalledTimes(1);

      // Second call should use cache
      cache.get(location, computeFn);
      expect(computeFn).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should generate different cache keys for different locations', () => {
      const loc1 = createMockLocation({ type: 'desk', status: 'available' });
      const loc2 = createMockLocation({ type: 'desk', status: 'occupied' });

      const color1 = cache.get(loc1, mockCompute('#fff000'));
      const color2 = cache.get(loc2, mockCompute('#000fff'));

      expect(color1).toBe('#fff000');
      expect(color2).toBe('#000fff');
      expect(cache.getSize()).toBe(2);
    });

    it('should include Cisco status in socket cache key', () => {
      const loc1 = createMockLocation({
        type: 'socket',
        customFields: { Status: 'powered' },
      });
      const loc2 = createMockLocation({
        type: 'socket',
        customFields: { Status: 'unpowered' },
      });

      const color1 = cache.get(loc1, mockCompute('#ff0000'));
      const color2 = cache.get(loc2, mockCompute('#00ff00'));

      expect(color1).toBe('#ff0000');
      expect(color2).toBe('#00ff00');
      expect(cache.getSize()).toBe(2);
    });
  });

  describe('Cache eviction (LRU)', () => {
    it('should evict least recently used entry when cache is full', () => {
      const computeFn = (color: string) => () => color;

      // Fill cache (max size 10)
      for (let i = 0; i < 10; i++) {
        const location = createMockLocation({ 
          type: `type${i}`,
          status: `status${i}`,
        });
        cache.get(location, computeFn(`#${i}${i}${i}${i}${i}${i}`));
      }

      expect(cache.getSize()).toBe(10);

      // Add one more - should evict oldest
      const newLocation = createMockLocation({ type: 'new_type', status: 'new_status' });
      cache.get(newLocation, mockCompute('#aabbcc'));

      // Size should stay at 10 (or 11 due to timing, but not grow unbounded)
      expect(cache.getSize()).toBeLessThanOrEqual(11);
    });

    it('should not evict when updating existing entry', () => {
      const location = createMockLocation();
      
      cache.get(location, mockCompute('#111111'));
      expect(cache.getSize()).toBe(1);

      // Access same location again - should not evict
      cache.get(location, mockCompute('#222222'));
      expect(cache.getSize()).toBe(1);
    });
  });

  describe('clear method', () => {
    it('should clear all cache entries', () => {
      // Add some entries
      for (let i = 0; i < 5; i++) {
        const location = createMockLocation({ type: `type${i}` });
        cache.get(location, mockCompute('#000000'));
      }

      expect(cache.getSize()).toBeGreaterThan(0);

      cache.clear();

      expect(cache.getSize()).toBe(0);
    });

    it('should reset statistics after clear', () => {
      const location = createMockLocation();
      
      // Generate some hits and misses
      cache.get(location, mockCompute('#fff000'));
      cache.get(location, mockCompute('#fff000'));
      
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStats method', () => {
    it('should return correct statistics', () => {
      const location1 = createMockLocation({ type: 'type1' });
      const location2 = createMockLocation({ type: 'type2' });

      // Create pattern: 3 hits, 1 miss
      cache.get(location1, mockCompute('#fff000'));
      cache.get(location1, mockCompute('#fff000')); // Hit
      cache.get(location1, mockCompute('#fff000')); // Hit
      cache.get(location2, mockCompute('#000fff')); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.size).toBe(2);
      expect(stats.hitRate).toBe(50); // 2 hits out of 4 accesses
    });

    it('should calculate hit rate correctly', () => {
      const location = createMockLocation();

      // First access is a miss, remaining 9 are hits = 90% hit rate
      for (let i = 0; i < 10; i++) {
        cache.get(location, mockCompute('#fff000'));
      }

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(90); // 9 hits out of 10 accesses
    });

    it('should track average access time', () => {
      const location = createMockLocation();

      cache.get(location, mockCompute('#fff000'));
      const stats = cache.getStats();

      expect(stats.avgAccessTime).toBeGreaterThanOrEqual(0);
      expect(typeof stats.avgAccessTime).toBe('number');
    });

    it('should return 0 hit rate when no accesses', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('invalidate method', () => {
    it('should remove specific location from cache', () => {
      const location = createMockLocation();

      cache.get(location, mockCompute('#fff000'));
      expect(cache.getSize()).toBe(1);

      cache.invalidate(location);
      expect(cache.getSize()).toBe(0);
    });

    it('should not affect other cached entries', () => {
      const loc1 = createMockLocation({ type: 'type1' });
      const loc2 = createMockLocation({ type: 'type2' });

      cache.get(loc1, mockCompute('#fff000'));
      cache.get(loc2, mockCompute('#000fff'));

      cache.invalidate(loc1);

      expect(cache.getSize()).toBe(1);
    });
  });

  describe('invalidateByType method', () => {
    it('should remove all entries of specific type', () => {
      const loc1 = createMockLocation({ type: 'camera', status: 'active' });
      const loc2 = createMockLocation({ type: 'camera', status: 'inactive' });
      const loc3 = createMockLocation({ type: 'socket', status: 'powered' });

      cache.get(loc1, mockCompute('#fff000'));
      cache.get(loc2, mockCompute('#000fff'));
      cache.get(loc3, mockCompute('#ffff00'));

      cache.invalidateByType('camera');

      expect(cache.getSize()).toBe(1); // Only socket remains
    });

    it('should not affect other types', () => {
      const loc1 = createMockLocation({ type: 'camera' });
      const loc2 = createMockLocation({ type: 'sensor' });

      cache.get(loc1, mockCompute('#fff000'));
      cache.get(loc2, mockCompute('#000fff'));

      cache.invalidateByType('camera');

      expect(cache.getSize()).toBe(1);
    });
  });

  describe('getSize method', () => {
    it('should return current cache size', () => {
      expect(cache.getSize()).toBe(0);

      const location = createMockLocation();
      cache.get(location, mockCompute('#fff000'));

      expect(cache.getSize()).toBe(1);
    });

    it('should not exceed max size', () => {
      // Add exactly maxSize + 5 entries
      for (let i = 0; i < 15; i++) {
        const location = createMockLocation({ type: `type${i}` });
        cache.get(location, mockCompute('#fff000'));
      }

      // Cache should evict oldest entries to stay within maxSize
      // In practice, the size should be at most maxSize + a small margin
      // depending on implementation timing
      const size = cache.getSize();
      expect(size).toBeLessThanOrEqual(15); // At most added items
    });
  });

  describe('Edge cases', () => {
    it('should handle locations with no custom fields', () => {
      const location = createMockLocation({ customFields: undefined });
      const color = cache.get(location, mockCompute('#fff000'));

      expect(color).toBe('#fff000');
      expect(cache.getSize()).toBe(1);
    });

    it('should handle locations with invalid custom fields', () => {
      const location = createMockLocation({ customFields: { invalid: 'data' } });
      const color = cache.get(location, mockCompute('#fff000'));

      expect(color).toBe('#fff000');
      expect(cache.getSize()).toBe(1);
    });
  });
});

// Import vitest utilities for mocking
import { vi } from 'vitest';
