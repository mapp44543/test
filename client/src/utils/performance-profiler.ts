/**
 * Performance Profiler для отладки производительности панорамирования на карте
 * Отслеживает FPS, время обработки событий, количество re-renders и прочее
 */

interface MetricsSnapshot {
  timestamp: number;
  fps: number;
  avgFrameTime: number;
  mouseMoveCount: number;
  updateMapTransformCount: number;
  setViewportCount: number;
  rafExecutionTime: number;
  blockingOperations: Array<{ name: string; duration: number; timestamp: number }>;
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  } | null;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private frameTimestamps: number[] = [];
  private metrics = {
    mouseMoveCount: 0,
    updateMapTransformCount: 0,
    setViewportCount: 0,
    rafExecutionTimes: [] as number[],
    blockingOperations: [] as { name: string; duration: number; timestamp: number }[],
  };
  private rafExecutionStart: number | null = null;
  private startTime = performance.now();
  private isActive = false;
  private lastBlockWarning = 0;

  private constructor() {}

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Начать профилирование
   */
  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.metrics = {
      mouseMoveCount: 0,
      updateMapTransformCount: 0,
      setViewportCount: 0,
      rafExecutionTimes: [],
      blockingOperations: [],
    };
    this.frameTimestamps = [];
    this.startTime = performance.now();
    console.log('%c🔴 Профилирование НАЧАТО', 'color: red; font-weight: bold; font-size: 14px');
  }

  /**
   * Остановить профилирование и вывести результаты
   */
  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.printMetrics();
  }

  /**
   * Отслеживать начало RAF выполнения
   */
  rafStart() {
    if (!this.isActive) return;
    this.rafExecutionStart = performance.now();
  }

  /**
   * Отслеживать конец RAF выполнения
   */
  rafEnd() {
    if (!this.isActive || !this.rafExecutionStart) return;
    const duration = performance.now() - this.rafExecutionStart;
    this.metrics.rafExecutionTimes.push(duration);
    
    // Warn if RAF takes too long (> 5ms on average means blocking)
    if (duration > 10) {
      const now = performance.now();
      if (now - this.lastBlockWarning > 1000) {
        console.warn(`⚠️  RAF BLOCKING: ${duration.toFixed(2)}ms (should be < 5ms)`);
        this.lastBlockWarning = now;
      }
    }
    
    this.rafExecutionStart = null;
  }

  /**
   * Отслеживать блокирующую операцию
   */
  recordBlockingOperation(name: string, startTime: number) {
    if (!this.isActive) return;
    const duration = performance.now() - startTime;
    
    if (duration > 5) {  // Only log operations > 5ms
      this.metrics.blockingOperations.push({
        name,
        duration,
        timestamp: performance.now(),
      });
      
      // Warn immediately if blocking
      if (duration > 16) {
        console.warn(`⚠️  BLOCKING OPERATION: ${name} took ${duration.toFixed(2)}ms!`);
      }
    }
  }

  /**
   * Отслеживать mousemove событие
   */
  recordMouseMove() {
    if (!this.isActive) return;
    this.metrics.mouseMoveCount++;
  }

  /**
   * Отслеживать вызов updateMapTransform
   */
  recordUpdateMapTransform() {
    if (!this.isActive) return;
    this.metrics.updateMapTransformCount++;
  }

  /**
   * Отслеживать вызов setViewportPanPosition
   */
  recordSetViewport() {
    if (!this.isActive) return;
    this.metrics.setViewportCount++;
  }

  /**
   * Записать timestamp кадра для расчета FPS
   */
  recordFrame() {
    if (!this.isActive) return;
    const now = performance.now();
    this.frameTimestamps.push(now);

    // Keep only last 60 frames (1 second at 60 FPS)
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }
  }

  /**
   * Получить текущий FPS
   */
  getCurrentFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;
    const span = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    if (span === 0) return 0;
    return Math.round((this.frameTimestamps.length / span) * 1000);
  }

  /**
   * Получить слепок метрик
   */
  getMetrics(): MetricsSnapshot {
    const fps = this.getCurrentFPS();
    const avgFrameTime =
      this.frameTimestamps.length > 1
        ? (this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0]) /
          Math.max(this.frameTimestamps.length - 1, 1)
        : 0;

    return {
      timestamp: performance.now(),
      fps,
      avgFrameTime,
      mouseMoveCount: this.metrics.mouseMoveCount,
      updateMapTransformCount: this.metrics.updateMapTransformCount,
      setViewportCount: this.metrics.setViewportCount,
      rafExecutionTime:
        this.metrics.rafExecutionTimes.length > 0
          ? this.metrics.rafExecutionTimes.reduce((a, b) => a + b, 0) /
            this.metrics.rafExecutionTimes.length
          : 0,
      blockingOperations: this.metrics.blockingOperations,
      memory:
        (performance as any).memory
          ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            }
          : null,
    };
  }

  /**
   * Вывести метрики в консоль
   */
  private printMetrics() {
    const metrics = this.getMetrics();
    const elapsedTime = performance.now() - this.startTime;

    console.clear();
    console.log('%c📊 PERFORMANCE METRICS', 'color: blue; font-weight: bold; font-size: 16px');
    console.log(`%cВремя профилирования: ${(elapsedTime / 1000).toFixed(2)}s`, 'font-size: 12px');
    console.log('');

    console.log('%c🎬 FPS & Frames', 'color: green; font-weight: bold');
    console.log(`   Current FPS: ${metrics.fps}`);
    console.log(`   Avg Frame Time: ${metrics.avgFrameTime.toFixed(2)}ms`);
    console.log(`   Total Frames: ${this.frameTimestamps.length}`);
    console.log('');

    console.log('%c🖱️  Mouse & Events', 'color: orange; font-weight: bold');
    console.log(`   mousemove events: ${metrics.mouseMoveCount}`);
    console.log(`   Events per second: ${(metrics.mouseMoveCount / (elapsedTime / 1000)).toFixed(0)}`);
    console.log('');

    console.log('%c⚙️  DOM Updates', 'color: purple; font-weight: bold');
    console.log(`   updateMapTransform calls: ${metrics.updateMapTransformCount}`);
    console.log(`   setViewportPanPosition calls: ${metrics.setViewportCount}`);
    console.log(`   RAF execution time (avg): ${metrics.rafExecutionTime.toFixed(2)}ms`);
    console.log('');

    console.log('%c💾 Memory', 'color: red; font-weight: bold');
    if (metrics.memory) {
      const usedMB = (metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (metrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
      console.log(`   Used JS Heap: ${usedMB} MB`);
      console.log(`   Total JS Heap: ${totalMB} MB`);
    } else {
      console.log(`   Memory API not available (Chrome DevTools mode required)`);
    }
    console.log('');

    // Recommendation
    console.log('%c💡 Анализ', 'color: cyan; font-weight: bold');
    if (metrics.fps < 30) {
      console.log(`   ⚠️  LOW FPS (${metrics.fps}). Есть проблемы с производительностью!`);
    } else if (metrics.fps < 50) {
      console.log(`   ⚠️  MEDIUM FPS (${metrics.fps}). Можно оптимизировать.`);
    } else {
      console.log(`   ✅ GOOD FPS (${metrics.fps}). Производительность в норме.`);
    }

    if (metrics.updateMapTransformCount > metrics.mouseMoveCount * 0.7) {
      console.log(`   ✅ updateMapTransform вызывается оптимально (${((metrics.updateMapTransformCount / metrics.mouseMoveCount) * 100).toFixed(0)}% от mousemove)`);
    }

    if (metrics.setViewportCount > 5) {
      console.log(`   ⚠️  setViewportPanPosition вызывается слишком часто (${metrics.setViewportCount} раз). Может вызвать лишние re-renders!`);
    } else {
      console.log(`   ✅ setViewportPanPosition оптимален (${metrics.setViewportCount} раз)`);
    }

    if (metrics.rafExecutionTime > 5) {
      console.log(`   ⚠️  RAF обработка медленная (${metrics.rafExecutionTime.toFixed(2)}ms). Может быть дорогая операция внутри!`);
    } else {
      console.log(`   ✅ RAF быстрый (${metrics.rafExecutionTime.toFixed(2)}ms)`);
    }

    // Show blocking operations
    if (metrics.blockingOperations.length > 0) {
      console.log('');
      console.log('%c🚨 BLOCKING OPERATIONS', 'color: red; font-weight: bold');
      metrics.blockingOperations.slice(0, 10).forEach((op) => {
        console.log(`   ${op.name}: ${op.duration.toFixed(2)}ms`);
      });
      if (metrics.blockingOperations.length > 10) {
        console.log(`   ... и еще ${metrics.blockingOperations.length - 10}`);
      }
    }
  }

  /**
   * Вывести live metrics каждые N миллисекунд
   */
  startLiveMetrics(intervalMs: number = 500) {
    if (!this.isActive) {
      console.warn('Профилирование не активно. Вызовите start() сначала.');
      return;
    }

    const interval = setInterval(() => {
      const metrics = this.getMetrics();
      console.clear();
      console.log('%c📊 LIVE METRICS', 'color: blue; font-weight: bold; font-size: 16px');
      console.log(`FPS: %c${metrics.fps}`, metrics.fps >= 50 ? 'color: green; font-weight: bold' : 'color: red; font-weight: bold');
      console.log(`mousemove: ${metrics.mouseMoveCount} | updateMapTransform: ${metrics.updateMapTransformCount} | setViewport: ${metrics.setViewportCount}`);
      console.log(`RAF time: ${metrics.rafExecutionTime.toFixed(2)}ms | Avg Frame: ${metrics.avgFrameTime.toFixed(2)}ms`);
    }, intervalMs);

    return () => clearInterval(interval);
  }
}
