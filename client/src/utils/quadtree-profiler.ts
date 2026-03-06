/**
 * Утилиты для профилирования и отладки Quadtree hit detection + Color Cache
 * 
 * Используйте эти функции в консоли браузера для измерения производительности
 */

export interface HitDetectionMetrics {
  totalTime: number;
  candidatesFound: number;
  actualMatch: boolean;
  markerClicked?: string;
}

export class QuadtreeProfiler {
  private metrics: HitDetectionMetrics[] = [];
  private isEnabled = true;

  /**
   * Начать профилирование hit detection
   */
  startProfiling() {
    this.metrics = [];
    this.isEnabled = true;
    console.log('🟢 Quadtree profiling started');
  }

  /**
   * Остановить профилирование и вернуть результаты
   */
  stopProfiling() {
    this.isEnabled = false;
    const stats = this.getStats();
    console.log('🔴 Quadtree profiling stopped');
    console.table(stats);
    return stats;
  }

  /**
   * Записать метрику hit detection
   */
  recordHit(metric: HitDetectionMetrics) {
    if (!this.isEnabled) return;
    this.metrics.push(metric);
  }

  /**
   * Получить статистику профилирования
   */
  getStats() {
    if (this.metrics.length === 0) {
      return { message: 'No metrics recorded yet' };
    }

    const times = this.metrics.map(m => m.totalTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    const candidatesCounts = this.metrics.map(m => m.candidatesFound);
    const avgCandidates = candidatesCounts.reduce((a, b) => a + b, 0) / candidatesCounts.length;

    // Получаем статистику кэша цветов, если он доступен
    let cacheStats = null;
    try {
      if ((window as any).ColorsCacheTools?.stats) {
        cacheStats = (window as any).ColorsCacheTools.stats();
      }
    } catch (e) {
      // Ignore if cache not available
    }

    const baseStats = {
      'Total Samples': this.metrics.length,
      'Avg Hit Detection Time (ms)': avgTime.toFixed(3),
      'Max Time (ms)': maxTime.toFixed(3),
      'Min Time (ms)': minTime.toFixed(3),
      'Avg Candidates Checked': avgCandidates.toFixed(1),
      'Click Success Rate': `${((this.metrics.filter(m => m.actualMatch).length / this.metrics.length) * 100).toFixed(1)}%`,
    };

    // Добавляем статистику кэша, если доступна
    if (cacheStats) {
      return {
        ...baseStats,
        '--- COLOR CACHE STATS ---': '---',
        'Cache Hit Rate': `${cacheStats.hitRate.toFixed(1)}%`,
        'Cache Hits': cacheStats.hits,
        'Cache Misses': cacheStats.misses,
        'Cache Size': `${cacheStats.size}/${cacheStats.maxSize}`,
        'Avg Access Time (ms)': cacheStats.avgAccessTime.toFixed(4),
      };
    }

    return baseStats;
  }

  /**
   * Вывести детальный лог последних N метрик
   */
  printLastN(n: number = 10) {
    const last = this.metrics.slice(-n);
    console.table(last.map((m, i) => ({
      '#': i,
      'Time (ms)': m.totalTime.toFixed(3),
      'Candidates': m.candidatesFound,
      'Match': m.actualMatch ? '✓' : '✗',
      'Marker': m.markerClicked || 'None',
    })));
  }

  /**
   * Сравнить текущее профилирование с предыдущим
   */
  compareWithBaseline() {
    const stats = this.getStats();
    console.log('📊 Hit Detection Performance:');
    const statsMap = stats as any;
    console.log(`Average time: ${(statsMap['Avg Hit Detection Time (ms)'] || 0).toFixed(3)}ms`);
    console.log(`Candidates checked: ${(statsMap['Avg Candidates Checked'] || 0).toFixed(1)}`);
    
    const avgTime = parseFloat((statsMap['Avg Hit Detection Time (ms)'] || 0).toFixed(3));
    
    if (avgTime < 5) {
      console.log('✅ EXCELLENT - Quadtree working perfectly!');
    } else if (avgTime < 10) {
      console.log('⚠️  OK - Good performance, but can optimize further');
    } else {
      console.log('❌ POOR - Hit detection is slow, check Quadtree');
    }
  }
}

// Глобальный экземпляр profiler
declare global {
  interface Window {
    quadtreeProfiler?: QuadtreeProfiler;
  }
}

// Инициализировать profiler в window
if (typeof window !== 'undefined') {
  window.quadtreeProfiler = new QuadtreeProfiler();
}

/**
 * Вспомогательные функции для тестирования в консоли браузера
 */
export const QuadtreeDebugTools = {
  /**
   * Начать профилирование
   * Использование: QuadtreeDebugTools.start()
   */
  start() {
    if (window.quadtreeProfiler) {
      window.quadtreeProfiler.startProfiling();
    }
    // Сбросить статистику кэша
    try {
      if ((window as any).ColorsCacheTools?.resetStats) {
        (window as any).ColorsCacheTools.resetStats();
        console.log('🟢 Color cache stats reset');
      }
    } catch (e) {
      // Ignore if cache not available
    }
  },

  /**
   * Остановить профилирование и показать результаты
   * Использование: QuadtreeDebugTools.stop()
   */
  stop() {
    if (window.quadtreeProfiler) {
      window.quadtreeProfiler.stopProfiling();
    }
  },

  /**
   * Показать статистику кэша цветов
   * Использование: QuadtreeDebugTools.cacheStats()
   */
  cacheStats() {
    try {
      if ((window as any).ColorsCacheTools?.stats) {
        const stats = (window as any).ColorsCacheTools.stats();
        console.log('📊 Color Cache Statistics:');
        console.table(stats);
        return stats;
      } else {
        console.log('⚠️  Color cache not available');
      }
    } catch (e) {
      console.error('Error getting cache stats:', e);
    }
  },

  /**
   * Очистить кэш цветов
   * Использование: QuadtreeDebugTools.clearCache()
   */
  clearCache() {
    try {
      if ((window as any).ColorsCacheTools?.clear) {
        (window as any).ColorsCacheTools.clear();
        console.log('✅ Color cache cleared');
      }
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  },

  /**
   * Показать последние N клики
   * Использование: QuadtreeDebugTools.showLast(10)
   */
  showLast(n: number = 10) {
    if (window.quadtreeProfiler) {
      window.quadtreeProfiler.printLastN(n);
    }
  },

  /**
   * Сравнить с baseline
   * Использование: QuadtreeDebugTools.compare()
   */
  compare() {
    if (window.quadtreeProfiler) {
      window.quadtreeProfiler.compareWithBaseline();
    }
  },

  /**
   * Полезные советы по тестированию
   * Использование: QuadtreeDebugTools.help()
   */
  help() {
    console.log(`
╔════════════════════════════════════════════════════════════════════╗
║   Quadtree Hit Detection + Color Cache - Debug Tools              ║
╚════════════════════════════════════════════════════════════════════╝

🎯 QUICK START:
  1. QuadtreeDebugTools.start()        // Start profiling
  2. Click on markers (10-20 times), hover over some
  3. QuadtreeDebugTools.stop()         // Stop and show results

📊 AVAILABLE COMMANDS:
  • QuadtreeDebugTools.start()         - Begin recording metrics & reset cache stats
  • QuadtreeDebugTools.stop()          - Stop recording and show stats with cache info
  • QuadtreeDebugTools.showLast(N)     - Show last N clicks (default 10)
  • QuadtreeDebugTools.compare()       - Compare with baseline performance
  • QuadtreeDebugTools.cacheStats()    - Show color cache statistics
  • QuadtreeDebugTools.clearCache()    - Clear color cache
  • QuadtreeDebugTools.help()          - Show this help message

🔍 WHAT TO LOOK FOR:
  
  HIT DETECTION (Quadtree):
    ✅ GOOD: < 5ms time, < 10 candidates
    ⚠️  OK: 5-10ms time, 10-20 candidates
    ❌ BAD: > 10ms time, > 50 candidates

  COLOR CACHE:
    ✅ GOOD: > 90% hit rate, < 0.5ms access time
    ⚠️  OK: 70-90% hit rate, 0.5-1ms access time
    ❌ BAD: < 70% hit rate, > 1ms access time

📈 EXAMPLE OUTPUT:
  ┌───────────────────────────────────────┬────────┐
  │ Total Samples                         │ 25     │
  │ Avg Hit Detection Time (ms)           │ 1.234  │
  │ Avg Candidates Checked                │ 4.7    │
  │ Click Success Rate                    │ 100%   │
  │ --- COLOR CACHE STATS ---             │ ---    │
  │ Cache Hit Rate                        │ 95.2%  │
  │ Cache Hits                            │ 58     │
  │ Cache Misses                          │ 3      │
  │ Cache Size                            │ 42/200 │
  │ Avg Access Time (ms)                  │ 0.032  │
  └───────────────────────────────────────┴────────┘

💡 EXPECTED IMPROVEMENTS:
  Phase 1 Step 1 (Quadtree): -88% hit detection time
  Phase 1 Step 2 (Color Cache): -15-20% CPU during render
  Combined: ~-35% total CPU usage during interaction
    `);
  },
};

/**
 * Вспомогательная функция для логирования в консоли
 */
export function logHitDetectionMetric(
  candidates: number,
  success: boolean,
  markerClicked?: string,
  executionTime?: number
) {
  if (window.quadtreeProfiler && executionTime !== undefined) {
    window.quadtreeProfiler.recordHit({
      totalTime: executionTime,
      candidatesFound: candidates,
      actualMatch: success,
      markerClicked,
    });
  }
}

// Экспортируем для использования в компоненте
export default QuadtreeDebugTools;
