import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuadtreeProfiler, HitDetectionMetrics } from './quadtree-profiler';

describe('QuadtreeProfiler', () => {
  let profiler: QuadtreeProfiler;

  beforeEach(() => {
    profiler = new QuadtreeProfiler();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  describe('Initialization', () => {
    it('should create a new profiler instance', () => {
      expect(profiler).toBeDefined();
      expect(profiler).toBeInstanceOf(QuadtreeProfiler);
    });

    it('should have empty metrics on creation', () => {
      const stats = profiler.getStats();
      expect(stats).toHaveProperty('message');
      expect((stats as any).message).toBe('No metrics recorded yet');
    });
  });

  describe('startProfiling / stopProfiling', () => {
    it('should start profiling without errors', () => {
      expect(() => profiler.startProfiling()).not.toThrow();
    });

    it('should stop profiling and return stats', () => {
      profiler.startProfiling();
      const stats = profiler.stopProfiling();
      expect(stats).toBeDefined();
    });

    it('should log messages when starting and stopping', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      profiler.startProfiling();
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Quadtree profiling started');

      profiler.stopProfiling();
      expect(consoleSpy).toHaveBeenCalledWith('🔴 Quadtree profiling stopped');
    });
  });

  describe('recordHit', () => {
    beforeEach(() => {
      profiler.startProfiling();
    });

    it('should record a hit detection metric', () => {
      const metric: HitDetectionMetrics = {
        totalTime: 5.5,
        candidatesFound: 10,
        actualMatch: true,
        markerClicked: 'marker-1',
      };

      profiler.recordHit(metric);
      const stats = profiler.getStats();

      // After recording one metric, should have stats
      expect((stats as any)['Total Samples']).toBe(1);
    });

    it('should not record hits when profiling is disabled', () => {
      profiler.stopProfiling();
      const metric: HitDetectionMetrics = {
        totalTime: 5.5,
        candidatesFound: 10,
        actualMatch: true,
      };

      profiler.recordHit(metric);
      const stats = profiler.getStats();

      // No metrics should be recorded after stopping
      expect((stats as any)['Total Samples']).toBeUndefined();
    });

    it('should record multiple hits correctly', () => {
      const metrics: HitDetectionMetrics[] = [
        { totalTime: 5.0, candidatesFound: 8, actualMatch: true },
        { totalTime: 7.0, candidatesFound: 12, actualMatch: true },
        { totalTime: 3.0, candidatesFound: 5, actualMatch: false },
      ];

      metrics.forEach(m => profiler.recordHit(m));
      const stats = profiler.getStats();

      expect((stats as any)['Total Samples']).toBe(3);
      expect((stats as any)['Avg Hit Detection Time (ms)']).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics with valid metrics', () => {
      profiler.startProfiling();
      
      // Record some hits
      const times = [5.0, 7.0, 3.0, 6.0, 4.0];
      const candidates = [8, 12, 5, 10, 7];
      
      times.forEach((time, i) => {
        profiler.recordHit({
          totalTime: time,
          candidatesFound: candidates[i],
          actualMatch: i % 2 === 0,
        });
      });

      const stats = profiler.getStats() as any;

      expect(stats['Total Samples']).toBe(5);
      expect(stats['Avg Hit Detection Time (ms)']).toBeDefined();
      expect(stats['Max Time (ms)']).toBe('7.000');
      expect(stats['Min Time (ms)']).toBe('3.000');
      expect(stats['Avg Candidates Checked']).toBeDefined();
      expect(stats['Click Success Rate']).toBeDefined();
    });

    it('should calculate correct average time', () => {
      profiler.startProfiling();
      
      // Record metrics with simple values for easy calculation
      profiler.recordHit({ totalTime: 10, candidatesFound: 5, actualMatch: true });
      profiler.recordHit({ totalTime: 20, candidatesFound: 5, actualMatch: true });

      const stats = profiler.getStats() as any;
      const avgTime = parseFloat(stats['Avg Hit Detection Time (ms)']);

      expect(avgTime).toBeCloseTo(15, 2);
    });

    it('should calculate success rate correctly', () => {
      profiler.startProfiling();
      
      // 3 successful, 1 failed
      profiler.recordHit({ totalTime: 5, candidatesFound: 8, actualMatch: true });
      profiler.recordHit({ totalTime: 5, candidatesFound: 8, actualMatch: true });
      profiler.recordHit({ totalTime: 5, candidatesFound: 8, actualMatch: true });
      profiler.recordHit({ totalTime: 5, candidatesFound: 8, actualMatch: false });

      const stats = profiler.getStats() as any;
      expect(stats['Click Success Rate']).toBe('75.0%');
    });
  });

  describe('printLastN', () => {
    it('should print last N metrics without errors', () => {
      profiler.startProfiling();
      
      for (let i = 0; i < 15; i++) {
        profiler.recordHit({
          totalTime: Math.random() * 10,
          candidatesFound: Math.floor(Math.random() * 20),
          actualMatch: Math.random() > 0.5,
        });
      }

      const consoleSpy = vi.spyOn(console, 'table');
      profiler.printLastN(5);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should default to printing last 10 if N not specified', () => {
      profiler.startProfiling();
      
      for (let i = 0; i < 15; i++) {
        profiler.recordHit({
          totalTime: Math.random() * 10,
          candidatesFound: Math.floor(Math.random() * 20),
          actualMatch: Math.random() > 0.5,
        });
      }

      const consoleSpy = vi.spyOn(console, 'table');
      profiler.printLastN();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('compareWithBaseline', () => {
    it('should evaluate performance correctly', () => {
      profiler.startProfiling();
      const consoleSpy = vi.spyOn(console, 'log');

      // Excellent performance
      for (let i = 0; i < 5; i++) {
        profiler.recordHit({ totalTime: 3.5, candidatesFound: 8, actualMatch: true });
      }
      profiler.compareWithBaseline();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('EXCELLENT'));

      // Reset for next test
      consoleSpy.mockClear();
      profiler = new QuadtreeProfiler();
      profiler.startProfiling();

      // OK performance
      for (let i = 0; i < 5; i++) {
        profiler.recordHit({ totalTime: 7.5, candidatesFound: 15, actualMatch: true });
      }
      profiler.compareWithBaseline();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('OK'));
    });

    it('should handle empty metrics gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // compareWithBaseline with no metrics should not crash
      expect(() => profiler.compareWithBaseline()).not.toThrow();
    });
  });

  describe('Window integration', () => {
    it('should be available on window object in browser', () => {
      if (typeof window !== 'undefined') {
        expect((window as any).quadtreeProfiler).toBeDefined();
      }
    });
  });
});
