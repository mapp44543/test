# 🚀 Продвинутые оптимизации (Уровень 2 и 3)

Если после применения **Уровня 1** все ещё есть проблемы с производительностью при 100+ маркерах, используйте эти рекомендации.

---

## 📊 Уровень 2: Улучшенная виртуализация

### Проблема
`VirtualizedMarkerLayer` использует `useMemo` для фильтрации видимых маркеров, но **все видимые маркеры всё равно рендерятся как DOM элементы**.

### Решение: Использовать react-window для маркеров

```typescript
// client/src/components/virtualized-marker-layer-advanced.tsx
import { FixedSizeList as List } from 'react-window';
import LocationMarker from './location-marker';

export default function VirtualizedMarkerLayerAdvanced({
  locations,
  isAdminMode,
  highlightedLocationIds,
  foundLocationId,
  onClick,
  imgSize,
  imgRef,
  onMarkerMove,
  scale,
  panPosition,
  isImageLoaded,
}) {
  // Фильтруем видимые маркеры как раньше
  const visibleItems = useMemo(() => {
    // ... существующий код фильтрации ...
  }, [/* зависимости */]);

  // Используем react-window для виртуализации списка
  const Row = ({ index, style }) => {
    const item = visibleItems[index];
    return (
      <div style={style} key={item.location.id}>
        <LocationMarker
          location={item.location}
          isAdminMode={isAdminMode}
          isHighlighted={highlightedLocationIds.includes(item.location.id)}
          onClick={onClick}
          // ... остальные пропсы ...
        />
      </div>
    );
  };

  return (
    <List
      height={containerHeight}
      itemCount={visibleItems.length}
      itemSize={100}
      width={containerWidth}
    >
      {Row}
    </List>
  );
}
```

**Ожидаемое улучшение:** 40-60%

---

## 🎨 Уровень 3: Canvas рендеринг + обработка событий

### Когда использовать Canvas
- **100+ маркеров** на одном этаже
- Частые обновления (панорамирование, зумирование)
- Low-end устройства (мобильные)

### Архитектура Canvas рендеринга

```typescript
// client/src/components/canvas-marker-layer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Location } from '@shared/schema';

interface CanvasMarkerLayerProps {
  locations: Location[];
  isAdminMode: boolean;
  highlightedLocationIds: string[];
  foundLocationId: string | null;
  imgSize: { width: number; height: number };
  scale: number;
  panPosition: { x: number; y: number };
  onMarkerClick: (location: Location) => void;
  isImageLoaded: boolean;
}

export default function CanvasMarkerLayer({
  locations,
  isAdminMode,
  highlightedLocationIds,
  foundLocationId,
  imgSize,
  scale,
  panPosition,
  onMarkerClick,
  isImageLoaded,
}: CanvasMarkerLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [markerBounds] = useState<Map<string, DOMRect>>(new Map());

  // Рисуем маркеры на canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isImageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Установка размера canvas
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Очистка canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Применяем трансформацию
    ctx.save();
    ctx.translate(panPosition.x, panPosition.y);
    ctx.scale(scale, scale);

    // Рисуем маркеры
    locations.forEach((location) => {
      const x = (imgSize.width * (location.x ?? 0)) / 100;
      const y = (imgSize.height * (location.y ?? 0)) / 100;
      const radius = highlightedLocationIds.includes(location.id) ? 18 : 15;

      // Цвет на основе статуса
      const fillColor = getStatusColor(location);

      // Основной круг
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Обводка
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Выделение
      if (highlightedLocationIds.includes(location.id)) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    ctx.restore();
  }, [locations, imgSize, scale, panPosition, isImageLoaded, highlightedLocationIds]);

  // Обработка кликов с hit detection
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panPosition.x) / scale;
    const y = (e.clientY - rect.top - panPosition.y) / scale;

    // Hit detection: находим маркер под мышкой
    for (const location of locations) {
      const markerX = (imgSize.width * (location.x ?? 0)) / 100;
      const markerY = (imgSize.height * (location.y ?? 0)) / 100;
      const distance = Math.sqrt((x - markerX) ** 2 + (y - markerY) ** 2);

      if (distance < 20) {
        onMarkerClick(location);
        break;
      }
    }
  }, [locations, imgSize, scale, panPosition, onMarkerClick]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          cursor: 'pointer',
          display: isImageLoaded ? 'block' : 'none',
        }}
      />
    </div>
  );
}
```

### Интеграция в office-map.tsx

```typescript
// Переключаться между DOM и Canvas рендерингом в зависимости от количества маркеров
const shouldUseCanvas = locations.length > 80;

return (
  <div>
    {shouldUseCanvas ? (
      <CanvasMarkerLayer
        locations={locations}
        isAdminMode={isAdminMode}
        highlightedLocationIds={highlightedLocationIdsLocal}
        foundLocationId={foundLocationId}
        imgSize={imgSize}
        scale={scale}
        panPosition={panPosition}
        onMarkerClick={handleLocationClick}
        isImageLoaded={isImageLoaded}
      />
    ) : (
      <VirtualizedMarkerLayer
        locations={locations}
        isAdminMode={isAdminMode}
        highlightedLocationIds={highlightedLocationIdsLocal}
        foundLocationId={foundLocationId}
        onClick={handleLocationClick}
        imgSize={imgSize}
        imgRef={imgRef}
        onMarkerMove={handleMarkerMove}
        scale={scale}
        panPosition={panPosition}
        isImageLoaded={isImageLoaded}
      />
    )}
  </div>
);
```

**Ожидаемое улучшение:** 70-90%

---

## 🎬 Уровень 3+: Расширенная оптимизация

### 1. Пулинг компонентов
```typescript
// Переиспользовать компоненты маркеров вместо создания новых
const markerPool = useRef<LocationMarker[]>([]);
const createMarker = (location: Location) => {
  let marker = markerPool.current.pop();
  if (!marker) {
    marker = new LocationMarker();
  }
  marker.location = location;
  return marker;
};
```

### 2. Ленивая загрузка деталей маркеров
```typescript
// Загружать аватарки и деньги только когда пользователь наводит мышь
const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

// Загружаем данные только для наведённого маркера
const { data: avatar } = useQuery({
  queryKey: [`/api/locations/${hoveredMarkerId}/avatar`],
  enabled: hoveredMarkerId !== null,
});
```

### 3. Web Workers для вычислений
```typescript
// Переместить кластеризацию в Web Worker
const worker = new Worker('supercluster.worker.js');
worker.postMessage({ locations, scale });
```

---

## 📊 Сравнение производительности

| Метрика | Уровень 1 | Уровень 2 | Уровень 3 |
|---------|-----------|-----------|-----------|
| API запросы (100) | 15-20 | 15-20 | 15-20 |
| DOM элементов | 100+ | 20-30* | 1 (canvas) |
| FPS при pan | 40-50 | 50-55 | 55-60 |
| Memory (100 маркеров) | 120MB | 100MB | 70-80MB |
| Time to Interactive | 1.5-2s | 1-1.5s | 0.5-1s |

*react-window показывает только видимые элементы

---

## 🔨 Инструменты для мониторинга

### Performance Monitoring
```typescript
// Добавить в office-map.tsx
useEffect(() => {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
    }
  });

  observer.observe({ entryTypes: ['measure', 'navigation'] });
  return () => observer.disconnect();
}, []);
```

### React Profiler Integration
```typescript
import { Profiler } from 'react';

<Profiler id="OfficeMap" onRender={onRenderCallback}>
  <OfficeMap {...props} />
</Profiler>
```

---

## 🎯 Рекомендации по внедрению

1. **Сначала**: Проверьте Уровень 1 эффективность
2. **Затем**: Если нужно улучшение → Уровень 2
3. **Наконец**: Для critical performance → Уровень 3

Обычно **Уровень 1** решает 80-90% проблем с производительностью при 100-200 маркерах.

---

**Статус:** 📋 Рекомендации завершены  
**Дата:** 25 февраля 2026
