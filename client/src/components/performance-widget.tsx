import React, { useState, useEffect } from 'react';
import { PerformanceProfiler } from '@/utils/performance-profiler';

export default function PerformanceWidget() {
  const [isActive, setIsActive] = useState(false);
  const [metrics, setMetrics] = useState({
    fps: 0,
    mouseMoveCount: 0,
    updateCount: 0,
    setViewportCount: 0,
  });

  useEffect(() => {
    // Обновляем метрики каждые 500ms
    const interval = setInterval(() => {
      const profiler = PerformanceProfiler.getInstance();
      const m = profiler.getMetrics();
      setMetrics({
        fps: m.fps,
        mouseMoveCount: m.mouseMoveCount,
        updateCount: m.updateMapTransformCount,
        setViewportCount: m.setViewportCount,
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    PerformanceProfiler.getInstance().start();
    setIsActive(true);
  };

  const handleStop = () => {
    PerformanceProfiler.getInstance().stop();
    setIsActive(false);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-40 bg-black/80 text-white rounded-lg p-3 text-xs font-mono"
      style={{ minWidth: '250px' }}
    >
      <div className="mb-2 font-bold">⚡ Performance Monitor</div>
      
      <div className="space-y-1 mb-2 pb-2 border-b border-white/20">
        <div>
          FPS: <span className={metrics.fps >= 50 ? 'text-green-400' : metrics.fps >= 30 ? 'text-yellow-400' : 'text-red-400'}>
            {metrics.fps}
          </span>
        </div>
        <div>mousemove: {metrics.mouseMoveCount}</div>
        <div>updateMapTransform: {metrics.updateCount}</div>
        <div>setViewport: {metrics.setViewportCount}</div>
      </div>

      <div className="space-y-2">
        {!isActive ? (
          <button
            onClick={handleStart}
            className="w-full bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white text-xs font-bold"
          >
            Start Profile (Ctrl+S)
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white text-xs font-bold"
          >
            Stop Profile (ESC)
          </button>
        )}
      </div>

      <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-white/20">
        <div>Ctrl+S: Start</div>
        <div>ESC: Stop &amp; Report</div>
      </div>
    </div>
  );
}
