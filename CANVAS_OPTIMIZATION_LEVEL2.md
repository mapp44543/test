# Дополнительная оптимизация Canvas компонента (УРОВЕНЬ 2)

## Статус
**Файл**: `canvas-interactive-marker-layer.tsx`  
**Приоритет**: СРЕДНИЙ (только если 150+ маркеров)

---

## 1. ТЕКУЩИЕ ПРОБЛЕМЫ В CANVAS КОМПОНЕНТЕ

### 1.1 Проблема: Множественные addEventListener/removeEventListener

**Файл**: `canvas-interactive-marker-layer.tsx`, строка ~100+

Текущий подход:
```typescript
useEffect(() => {
  canvas.addEventListener('mousemove', handleMouseMove);
  return () => canvas.removeEventListener('mousemove', handleMouseMove);
}, [handleMouseMove]); // ❌ Зависит от callback
```

**Решение**:
```typescript
const mouseHandlerRef = useRef<(e: MouseEvent) => void | null>(null);

useEffect(() => {
  mouseHandlerRef.current = (e: MouseEvent) => {
    // Использовать refs вместо state
    const hoveredId = checkCollision(e, markerBoundsRef.current);
    if (hoveredMarkerIdRef.current !== hoveredId) {
      hoveredMarkerIdRef.current = hoveredId;
      setHoveredMarkerId(hoveredId);
      requestAnimationFrame(() => {
        redrawCanvas();
      });
    }
  };
}, []);

useEffect(() => {
  if (!canvasRef.current || !mouseHandlerRef.current) return;
  canvasRef.current.addEventListener('mousemove', mouseHandlerRef.current);
  return () => {
    if (canvasRef.current && mouseHandlerRef.current) {
      canvasRef.current.removeEventListener('mousemove', mouseHandlerRef.current);
    }
  };
}, []);
```

### 1.2 Проблема: Redundant quadtree rebuilds

**Текущий подход**:
```typescript
useEffect(() => {
  // Rebuild quadtree при каждом изменении locations
  const newQuadtree = new Quadtree(...);
  locations.forEach(loc => newQuadtree.insert(...));
  quadtreeRef.current = newQuadtree;
}, [locations]); // ❌ Перестраивается при каждом изменении locations
```

**Решение**: Используйте incremental updates вместо полной перестройки

```typescript
useEffect(() => {
  if (!quadtreeRef.current) {
    // First time: build from scratch
    const newQuadtree = new Quadtree(...);
    locations.forEach(loc => newQuadtree.insert(...));
    quadtreeRef.current = newQuadtree;
  } else {
    // Subsequent: incremental update (гораздо быстрее!)
    // Это требует API изменений в Quadtree, но стоит того
  }
}, [locations]);
```

### 1.3 Проблема: RAF loop не оптимизирована

**Текущий подход**:
```typescript
useEffect(() => {
  const rafId = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(rafId);
}, []); // Может быть не оптимизирована
```

**Оптимизация**:
```typescript
const rafIdRef = useRef<number | null>(null);
const needsRedrawRef = useRef<boolean>(true);

const scheduleRedraw = () => {
  needsRedrawRef.current = true;
  if (rafIdRef.current === null) {
    rafIdRef.current = requestAnimationFrame(() => {
      if (needsRedrawRef.current) {
        redrawCanvas();
        needsRedrawRef.current = false;
      }
      rafIdRef.current = null;
    });
  }
};

// Вместо вызова redrawCanvas() везде, используйте scheduleRedraw()
```

---

## 2. REACT 19 СПЕЦИФИЧНЫЕ ПРОБЛЕМЫ

### 2.1 useState не синхронизирована с canvas

**Problem**: Canvas рендерится с одной частотой, state обновляется с другой

```typescript
// Canvas использует scaleRef/panPositionRef напрямую
canva.drawCircle(location.x * scaleRef.current + panPositionRef.current.x, ...);

// Но эти refs не всегда синхронизированы со state
```

**Решение**:
```typescript
// Используйте эффект для синхронизации
useEffect(() => {
  scaleRef.current = scale;
  panPositionRef.current = panPosition;
  scheduleRedraw();
}, [scale, panPosition]);
```

---

## 3. ДЕЙСТВИЯ ДЛЯ РЕАЛИЗАЦИИ

### Шаг 1: Стабилизировать mouse event handlers

Раз мы уже исправили это в `office-map.tsx`, убедитесь что `canvas-interactive-marker-layer.tsx` следует такому же паттерну.

### Шаг 2: Интегрировать quadtree incremental updates

Если quadtree имеет метод `update()` вместо полной перестройки, это может дать 10-50x ускорение.

### Шаг 3: Кэшировать computed values

```typescript
// Вычислять один раз в RAF, а не в каждом draw()
const computedMarkers = useMemo(() => ({
  visible: calculateVisibleMarkers(scale, panPosition, imgSize),
  hovered: hoveredMarkerId,
  highlighted: highlightedLocationIds
}), [scale, panPosition, imgSize, hoveredMarkerId, highlightedLocationIds]);
```

### Шаг 4: Используйте Web Workers для heavy computations

Для 150+ маркеров, quadtree lookups и hit detection можно переместить в Web Worker.

---

## 4. МОНИТОРИНГ ПРОИЗВОДИТЕЛЬНОСТИ

Добавить простой профайлер:

```typescript
// В development режиме
const perfStart = performance.now();
// ... draw operation ...
const perfEnd = performance.now();

if (perfEnd - perfStart > 16) { // Если дольше чем 1 frame @ 60fps
  console.warn(`Canvas draw took ${perfEnd - perfStart}ms`, {
    markerCount: locations.length,
    scale,
    panPosition
  });
}
```

---

## 5. ТЕСТИРОВАНИЕ

После оптимизации test:
1. Загрузить 200-300 маркеров
2. Быстро zoom in/out
3. Быстро панорамировать
4. Проверить DevTools Performance tab
5. Убедиться что FPS остаётся выше 50

---

## РЕЗЮМЕ

Canvas оптимизация требует более продвинутого подхода, но может дать:
- **2-5x улучшение** при 150-300 маркерах
- **5-10x улучшение** при 300+ маркерах (с Web Workers)

Однако, для большинства использовать основные оптимизации (которые уже сделаны) должно хватить для 150 маркеров.
